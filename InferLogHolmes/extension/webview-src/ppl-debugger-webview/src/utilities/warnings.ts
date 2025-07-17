import { PPL } from "../PPL/ppl";
import { getTraceValues, multiChainACF, multiChainESS, rankNormalizedRHat } from "./helper";
import { type TraceItem } from "./lasappTypes"
export enum WorkerTopic {
	GetWarnings
}

export type HMCDebuggingState = {
	method: "hmc",
	params: {
		L: number,
		epsilon: number,
		varNames?: string[]
	}
}

export type MHDebuggingState = {
	method: "metropolis_hastings",
	params: {
		blockUpdates: string,
		varNames?: string[]
	}
}

// TODO: NUTS warnings not implemented. Just here for compatibliity with pymc default sampler
export type NUTSDebuggingState = {
	method: "nuts",
	params: {
		target_accept: number,
		max_treedepth: number,
		step_size: number,
		varNames?: string[]
	}
}

export type SingleDebuggingState = MHDebuggingState | HMCDebuggingState | NUTSDebuggingState

export type DebuggingState = {
	ppl: string,
	alg: SingleDebuggingState | SingleDebuggingState[],
	totalIteration: number,
	burnin: number,
	chains: number,
	trace: TraceItem[][],
}

export type WarningConfig = {
	AcceptanceRateThreshold: number,
	AcceptanceRateUpperThreshold: number,
	CheckFunnel: boolean,
	ESSTargetThreshold: number,
	RHatSplitChainESSThreshold: number,
	RHatThreshold: number,
	EssCalcEvery: number
}

export let WARNING_CONFIG = {
	"hmc": {
		AcceptanceRateThreshold: 0.6,
		AcceptanceRateUpperThreshold: 0.95,
		CheckFunnel: true,
		ESSTargetThreshold: 400,
		RHatSplitChainESSThreshold: 50,
		RHatThreshold: 1.01,
		EssCalcEvery: 20
	},
	"nuts": {
		AcceptanceRateThreshold: 0.6,
		AcceptanceRateUpperThreshold: 0.95,
		CheckFunnel: true,
		ESSTargetThreshold: 400,
		RHatSplitChainESSThreshold: 50,
		RHatThreshold: 1.01,
		EssCalcEvery: 20
	},
	"metropolis_hastings": {
		AcceptanceRateThreshold: 0.2,
		AcceptanceRateUpperThreshold: 0.65,
		CheckFunnel: true,
		ESSTargetThreshold: 400,
		RHatSplitChainESSThreshold: 50,
		RHatThreshold: 1.01,
		EssCalcEvery: 20
	}
}

export type ChainStats = {
	acceptanceRate: number,
	isStuckChain?: number,
	ess: number,
	acf: number[],
	includesBurnin: boolean,
	rHat?: number,
	rhatWindowStats?: BurninRHatWindowStats[],
	drawnAt: number
}

export function* enumerate(n: number): Generator<number> {
	for(let i = 0; i < n; i++) {
		yield i
	}
}


type BurninRHatWindowStats = {
	chain: number, 
	rhatLeft: number, 
	rhatRight: number, 
	essLeft: number, 
	essRight: number, 
	rhatOW: {rhat: number, draw: number}[]
}
export class Block {
	blocks: HelpfulWarningBlock[] = [];
	issueStr: string | null = null;
	solutionStr: string | null = null;
	severity: number = 1;

	addBlock(type: HelpfulWarningBlockType, value: any, severity: number = 1) {
		this.blocks.push({type, value});
		this.severity += severity;
	}

	issue(issue: string) {
		this.issueStr = issue;
	}

	solution(solution: string) {
		this.solutionStr = solution;
	}
}

export type HelpfulWarningObject = {
	variable: string;
	baseVariable: string; 
	severity: number;
	includesBurnin: boolean;
	mainBlock: HelpfulWarningBlock[];
	blocks: {blocks: HelpfulWarningBlock[], issue: string | null, solution: string | null, severity: number}[];
} 
export class HelpfulWarning {
	variable: string;
	baseVariable: string; 
	severity: number = 1;
	includesBurnin: boolean;
	mainBlock: HelpfulWarningBlock[] = [];
	blocks: Block[] = [];

	constructor(variable: string, baseVariable: string, includesBurnin: boolean) {
		this.variable = variable;
		this.baseVariable = baseVariable;
		this.includesBurnin = includesBurnin;
	}

	addBlock(block: Block) {
		this.blocks.push(block);
		this.severity += block.severity;
	}

	addMainBlock(type: HelpfulWarningBlockType, value: any, severity: number = 1) {
		this.mainBlock.push({type, value});
		this.severity += severity;
	}

	hasAny() {
		return this.blocks.length > 0 || this.mainBlock.length > 0;
	}

	toHelpfulWarningObject(): HelpfulWarningObject {
		return {
			variable: this.variable,
			baseVariable: this.baseVariable,
			severity: this.severity,
			includesBurnin: this.includesBurnin,
			mainBlock: this.mainBlock,
			blocks: this.blocks.map(b => ({blocks: b.blocks, issue: b.issueStr, solution: b.solutionStr, severity: b.severity})).toSorted((a, b) => b.severity - a.severity)
		}
	}
}
export type HelpfulWarningBlock = {
	type: HelpfulWarningBlockType,
	value: any
}
export enum HelpfulWarningBlockType {
	Text,
	TextBold,
	Plot,
	Html,
	Code,
	ShowMeWhere,
	PPLInfo,
	Space,
}


export function checkAccepted(t: TraceItem, idx: number) {
	return t.accepted instanceof Array ? t.accepted[idx] : t.accepted
}

export function getHelpfulWarning(state: DebuggingState, variable: string, stats: ChainStats, knownFunnels: any): HelpfulWarningObject | null {
	const method = state.alg instanceof Array ? state.alg.find(a => a.params.varNames && a.params.varNames.includes(variable.replace(/_\d+/, "")))?.method ?? 'metropolis_hastings' : state.alg.method;
	let config = WARNING_CONFIG[method];

	const ppl = PPL.getPPLByName(state.ppl);

	const acceptanceRateLowWarning = method != "nuts" && isFinite(stats.acceptanceRate) && stats.acceptanceRate < config.AcceptanceRateThreshold;
	const acceptanceRateHighWarning = method != "nuts" && isFinite(stats.acceptanceRate) && stats.acceptanceRate > config.AcceptanceRateUpperThreshold;
	const stuckChainWarning = method != "nuts" && stats.isStuckChain != null;
	const funnelWarning = config.CheckFunnel && (checkFunnel(variable, 0, knownFunnels) as false | any);
	const essWarning = stats.ess < (config.ESSTargetThreshold * (stats.drawnAt / state.totalIteration));
	const rhatsWarning = stats.rHat && stats.rHat > config.RHatThreshold;
	//const burninWarning = stats.burninTest != null && stats.burninTest.length;
	const burninWarning = stats.rhatWindowStats != null && stats.rhatWindowStats.find(r => r.rhatLeft >= config.RHatThreshold && r.rhatLeft >= r.rhatRight) != null;

	const warning = new HelpfulWarning(variable, variable.replace(/_\d+/, ""), stats.includesBurnin);

	if(funnelWarning) {
		let block = new Block();
		block.issue(`${funnelWarning.warning.parent.name} ${"->"} ${funnelWarning.warning.child.name} result in a difficult posterior.`)
		block.solution(`Try reparametrizing the model:`);

		block.addBlock(
			HelpfulWarningBlockType.Text, 
			`There is a funnel between ${funnelWarning.warning.parent.name} ${"->"} `
			+ `${funnelWarning.warning.child.name}, that's probably not completely explored `
			+ `by the inference algorithm.`, 
			10
		);

		block.addBlock(
			HelpfulWarningBlockType.Plot, 
			{
				chart: "pairplot", 
				variable1: funnelWarning.warning.parent.name, 
				variable2: funnelWarning.warning.child.name, 
				chain: 0
			}, 
			0
		);

		block.addBlock(
			HelpfulWarningBlockType.Text, 
			`It might help to reparameterize your model:`, 
			0
		);

		block.addBlock(HelpfulWarningBlockType.TextBold, `Change:`, 0);
		block.addBlock(
			HelpfulWarningBlockType.Code, 
			`${funnelWarning.warning.child.node.source_text}`, 
			0
		);

		block.addBlock(HelpfulWarningBlockType.TextBold, `To:`, 0);

		const ppl = PPL.getPPL(funnelWarning.warning.child.node.source_text);
		
		block.addBlock(HelpfulWarningBlockType.Code, `${ppl.reparameterize(funnelWarning.warning.child.node.source_text)}`, 0);
		block.addBlock(HelpfulWarningBlockType.ShowMeWhere, funnelWarning, 0);
		block = ppl.maybeAddPPLInfoBlock("Funnel", block);
		warning.addBlock(block);
	}

	if(rhatsWarning) {
		let block = new Block();
		if(stats.ess < config.RHatSplitChainESSThreshold * state.chains) {
			block.issue(`High RHat: ${stats.rHat?.toFixed(3)} (Not certain due to low ESS)`)
			block.addBlock(
				HelpfulWarningBlockType.TextBold, 
				`ESS is very low (${stats.ess.toFixed(3)}). Due to the low ESS, `
				+ `RHat may not be correct.`, 
				0
			);
		} else {
			block.issue(`High RHat: ${stats.rHat?.toFixed(3)}`)
			block.solution(`See other warnings.`)
		}
		
		block.addBlock(
			HelpfulWarningBlockType.Text, 
			`Your RHat value is ${stats.rHat?.toFixed(3)}. An RHat value `
			//@ts-ignore
			+ `${stats.rHat >= 1.1 ? "greater than 1.1 strongly indicates" : "greater than 1.01 can be an indicator"} `
			+ `that the chains have not mixed well. This can be due to a variety of reasons, such as a bad `
			+ `starting point, a bad  proposal function, or a bad model. You can check the Rank plots below `
			+ `to see if the  chains are mixing well.`, 
			10
		);

		block.addBlock(HelpfulWarningBlockType.Plot, {chart: "rank-grid", variable: variable}, 0);

		block.addBlock(
			HelpfulWarningBlockType.Text, 
			`If the chains have mixed well you should see this by mostly uniform Rank plots. `
			+ `A non-uniform distribution in Rank plots suggests that the chains have not targeted `
			+ `the same posterior. Other Warnings are likely to give you more information and suggest `
			+ `possible solutions.`, 
			0
		);

		warning.addBlock(block);
	}

	if(burninWarning) {
		let block = new Block();
		//@ts-ignore
		block.issue(`Some Chains are not Burn-in free.`)
		block.solution(`Try increasing the ${ppl.getParameterName("burnin")} and total sample size.`)

		const burnInStats = stats.rhatWindowStats?.filter(r => r.rhatLeft >= config.RHatThreshold && r.rhatLeft >= r.rhatRight);

		block.addBlock(
			HelpfulWarningBlockType.Text, 
			`We detected that ${burnInStats?.length} ${burnInStats?.length || 0 > 1 ? "chains" : "chain"} `
			+ `might not be Burn-in free. See the partial-chain-RHat ${burnInStats?.length || 0 > 1 ? "plots" : "plot"} `
			+ `and the trace ${burnInStats?.length || 0 > 1 ? "charts" : "chart"} below. `
			+ `A high RHat value in parts of the chain usually indicates non-stationarity of the chain.`,
			0
		);

		block.addBlock(HelpfulWarningBlockType.Space, null, 0);

		//@ts-ignore
		for(let b of burnInStats) {
			// check if one side is below the (two times for each splitchain) ess threshold. If so, add a warning
			if(Math.min(b.essLeft, b.essRight) < config.RHatSplitChainESSThreshold ) {
				block.addBlock(
					HelpfulWarningBlockType.TextBold, 
					`The effective sample size of this chain is low at some points (${Math.min(b.essLeft, b.essRight).toFixed(3)}). Due to the low ESS `
					+ `this warning can be wrong. Please check for yourself and consider increasing the total sample size or taking other ESS increasing measures.`, 
					0
				);
			} else {
				block.severity += 1.5;
			}
			block.addBlock(
				HelpfulWarningBlockType.Text, 
				`Chain ${b.chain} has a split-Rhat value of ${b.rhatLeft.toFixed(3)} on the left side of the chain and  ${b.rhatRight.toFixed(3)} on the right side.`, 
				0
			);
			block.addBlock(
				HelpfulWarningBlockType.Text, 
				`Try increasing the ${ppl.getParameterName("burnin")} and total sample size.`, 
				0
			)
			block.addBlock(
				HelpfulWarningBlockType.Plot, 
				{
					chart: "trace-burnin-rhats", 
					variable: variable,
					chain: b.chain,
					target: config.RHatThreshold, 
					rhatData: b.rhatOW
				}, 
				0
			);
		}
		
		block = ppl.maybeAddPPLInfoBlock("Burnin", block);
		warning.addBlock(block);
	}

	if(stuckChainWarning) {
		if(stats.includesBurnin) {
			warning.addMainBlock(
				HelpfulWarningBlockType.TextBold, 
				`This warning was generated including data from the Burnin-samples. `
				+ `It might not be relevant and disappear with inference progressing further.`, 
				0
			);
		}
		warning.addMainBlock(
			HelpfulWarningBlockType.Text, 
			`The chain ${stats.isStuckChain} is stuck. The current acceptance rate is `
			+ `${stats.acceptanceRate.toFixed(3)}.`, 
			10
		);
		warning.addMainBlock(
			HelpfulWarningBlockType.Plot, 
			{
				chart: "trace", 
				variable: variable, 
				chain: stats.isStuckChain
			}, 
			0
		);
		warning.addMainBlock(
			HelpfulWarningBlockType.Text, 
			`If the trace continues to be stuck it is recommended to check your proposal functions and `
			+ `${ppl.getParameterName("stepsize")}. Make sure that they are chosen sensibly `
			+ `according to your model.`, 
			0
		);
	}
	else if(acceptanceRateHighWarning) {
		if(stats.includesBurnin) {
			warning.addMainBlock(
				HelpfulWarningBlockType.TextBold, 
				`This warning was generated including data from the Burnin-samples. `
				+ `It might not be relevant and disappear with inference progressing further.`, 
				0
			);
		}
		warning.addMainBlock(
			HelpfulWarningBlockType.Text, 
			`The acceptance rate is very high. The current acceptance rate is `
			+ `${stats.acceptanceRate.toFixed(3)}.`,
			1
		);
	}
	else if(acceptanceRateLowWarning) {
		if(stats.includesBurnin) {
			warning.addMainBlock(
				HelpfulWarningBlockType.TextBold, 
				`This warning was generated including data from the Burnin-samples. `
				+ `It might not be relevant and disappear with inference progressing further.`, 
				0
			);
		}
		warning.addMainBlock(
			HelpfulWarningBlockType.Text, 
			`The acceptance rate is very low. The current acceptance rate is `
			+ `${stats.acceptanceRate.toFixed(3)}.`,
			1
		);
	} 
	else if(essWarning && !stats.includesBurnin) {
		let block = new Block();
		block.issue(`Low ESS: ${stats.ess.toFixed(3)}`)
		block.solution(`Check other Warnings.`)

		block.addBlock(
			HelpfulWarningBlockType.Text, 
			`The effective Sample Size (ESS) is very small (${stats.ess.toFixed(3)}) `
			+ `compared to the total sample size. This means that the drawn samples have very low independence.`
			+ `You can see this by checking the autocorrelation plot:`, 
			0
		);
		block.addBlock(
			HelpfulWarningBlockType.Plot, 
			{chart: "acf", corr: stats.acf}, 
			0
		);
		block.addBlock(
			HelpfulWarningBlockType.Text, 
			`We are currently unsure why this is the case. Check other warnings, and variables. `
			+ `They might be indicative for this variable as well.`, 
			0
		);
		
		block = ppl.maybeAddPPLInfoBlock("ESS", block);
		warning.addBlock(block);
	}

	if(acceptanceRateHighWarning && essWarning) {
		let block = new Block();
		block.issue(`Low ESS: ${stats.ess.toFixed(3)}`)
		block.solution(`Increase the proposers ${ppl.getParameterName("stepsize")}.`)

		block.addBlock(
			HelpfulWarningBlockType.Text, 
			`The effective Sample Size (ESS) is very small (${stats.ess.toFixed(3)}) `
			+ `compared to the total sample size. This means that the drawn samples have very low independence. `
			+ `You can see this by checking the autocorrelation plot:`, 
			10
		);

		block.addBlock(HelpfulWarningBlockType.Plot, {chart: "acf", corr: stats.acf}, 0);

		block.addBlock(
			HelpfulWarningBlockType.Text, 
			`Together with the high acceptance rate this suggests that your proposer `
			+ `${ppl.getParameterName("stepsize")} might be too small. A smaller `
			+ `${ppl.getParameterName("stepsize")} means that the inference algorithm is less likely `
			+ `to explore areas far away from it's current position. While this can lead to high `
			+ `acceptance rates, it reduces the chance of exploring the full posterior.`, 
			0
		);

		block = ppl.maybeAddPPLInfoBlock("ESS", block);
		warning.addBlock(block);
	}
	if(acceptanceRateLowWarning && essWarning) {
		let block = new Block();
		block.issue(`Low ESS: ${stats.ess.toFixed(3)}`)
		block.solution(`Lower the proposers ${ppl.getParameterName("stepsize")}.`)

		block.addBlock(
			HelpfulWarningBlockType.Text, 
			`The effective Sample Size (ESS) is very small (${stats.ess.toFixed(3)}) compared to `
			+ `the total sample size. This means that the drawn samples have very low independence. `
			+ `You can see this by checking the autocorrelation plot:`, 
			10
		);

		block.addBlock(HelpfulWarningBlockType.Plot, {chart: "acf", corr: stats.acf}, 0);

		block.addBlock(
			HelpfulWarningBlockType.Text, 
			`Together with the small acceptance rate this suggests that your proposer `
			+ `${ppl.getParameterName("stepsize")} might be too large. While a large `
			+ `${ppl.getParameterName("stepsize")} generates a diverse sample set, the acceptance `
			+ `rate quite often drops. Another possible solution to this issue might be increasing `
			+ `the sample size. With increased sample size the ESS should increase as well.`, 
			0
		);

		block = ppl.maybeAddPPLInfoBlock("ESS", block);
		warning.addBlock(block);
	}
	if(!stuckChainWarning && (acceptanceRateHighWarning || acceptanceRateLowWarning)) { 
		warning.addMainBlock(
			HelpfulWarningBlockType.Plot, 
			{chart: "trace-grid", variable: variable, chain: 0}, 
			0
		);
		warning.addMainBlock(
			HelpfulWarningBlockType.Text, 
			`With your current inference algorithm (${method}), the acceptance rate is optimal `
			+ `between ${config.AcceptanceRateThreshold} and ${config.AcceptanceRateUpperThreshold}. `
			+ `This might be indicative of a problem.`, 
			0
		);
	}

	if(warning.mainBlock.length && !warning.blocks.length) { 
		let b = new Block()
		b.addBlock(
			HelpfulWarningBlockType.Text, 
			`Currently we are not able to detect the reason for this issue. You can try to `
			+ `change the ${ppl.getParameterName("stepsize")} of your proposer function or increase `
			+ `the total sample size and ${ppl.getParameterName("burnin")} period. Also look at `
			+ `warnings raised by other variables. They might be indicative for this variable as well.`,
			1
		)

		if(acceptanceRateLowWarning) {
			b.addBlock(
				HelpfulWarningBlockType.Text, 
				`Decreasing the ${ppl.getParameterName("stepsize")} should increase the acceptance rate.`, 
				0
			);
		} else {
			b.addBlock(
				HelpfulWarningBlockType.Text, 
				`Increasing the ${ppl.getParameterName("stepsize")} should decrease the acceptance rate.`, 
				0
			);
		}
		b = ppl.maybeAddPPLInfoBlock("ESS", b);
		warning.addBlock(b);
	}

	if(!warning.hasAny()) {
		return null;
	}
	if(!warning.mainBlock.length) {
		if(!essWarning && !rhatsWarning && ! burninWarning) {
			return null;
		} else {
			warning.addMainBlock(
				HelpfulWarningBlockType.Text, 
				`We detected potential issues with this variable.`, 
				0
			);
		}
	}

	if(method == "nuts") {
		warning.addMainBlock(
			HelpfulWarningBlockType.TextBold, 
			`NUTS support is limited. Take warnings with a grain of salt.`, 
			100
		);
	}
	return warning.toHelpfulWarningObject();
}

export function getWarnings(state: DebuggingState, knownFunnels: any, essOverTime: any, burninTest: boolean): any {
	// TODO: Burnin test
	// TODO: High acception rate test

	let allTraceVars = [...new Set(state.trace.flatMap(c => c.flatMap(t => Object.keys(t.trace_current))) ?? [])];

	let warningsObject: any = {}
	let nChains = state.trace.length;
	let nSamples = state.trace.reduce((p, c) => p + c.length, 0);

	for(let variable of allTraceVars) {
		let baseVar = variable.replace(/_\d+/, "");
		let method = state.alg instanceof Array ? state.alg.find(a => a.params.varNames && a.params.varNames.includes(baseVar))?.method ?? 'metropolis_hastings' : state.alg.method;
		let config = WARNING_CONFIG[method];

		let localTraces = state.trace.map(c => c.filter(t => !t.resample_addresses ? true : t.resample_addresses.includes(variable)));
		let acceptanceRate = (localTraces.map(c => c.filter(t => t.accepted).length / c.length).reduce((a, b) => a + b, 0) / localTraces.length);
		acceptanceRate = Number.isFinite(acceptanceRate) ? acceptanceRate : 0;

		let localWarning = checkAcceptanceRateWarning(localTraces, acceptanceRate, variable, config);

		if(config.CheckFunnel && localWarning) {
			let funnelWarning = checkFunnel(variable, localWarning.severity, knownFunnels);
			if(funnelWarning) {
				(localWarning.warning as TraceStuckWarning).causes.push(funnelWarning);
				localWarning.severity += 1;
			}
		}

		let vals = localTraces.map(c => getTraceValues(c, variable, false))
		let acf = multiChainACF(vals, 100);
		let ess = multiChainESS(acf, vals.length, Math.min(...vals.map(x => x.length)));

		ess = Number.isFinite(ess) ? ess : 0;

		if(!essOverTime[variable] || !essOverTime[variable].length) {
			essOverTime[variable] = []
		}

		essOverTime[variable].push(ess);

		if(ess < config.ESSTargetThreshold * (nSamples / (state.totalIteration * state.chains))) {
			if(localWarning) {
				(localWarning.warning as TraceStuckWarning).causes.push({
					severity: 5 * (nSamples / (state.totalIteration * state.chains)),
					warning: {
						typ: WarningType.SampleSizeWarning,
						variable: variable,
						autocorr: acf,
						ess: ess
					} as SampleSizeWarning
				});
			}
		}

		if(ess > config.RHatSplitChainESSThreshold * nChains) { 
			let rHat = rankNormalizedRHat(vals);
			if(localWarning && rHat > config.RHatThreshold) {
				(localWarning.warning as TraceStuckWarning).causes.push({
					severity: 5 * (nSamples / state.totalIteration),
					warning: {
						typ: WarningType.RHatWarning,
						variable: variable,
						autocorr: acf,
						ess: ess,
						rhat: rHat
					} as RHatWarning
				});
			}
		}

		if(warningsObject[baseVar] == null) {
			warningsObject[baseVar] = []
		}
		if(localWarning != null) {
			warningsObject[baseVar].push(localWarning);
		}
	}

	return [warningsObject, essOverTime];
}

function checkAcceptanceRateWarning(localTraces: TraceItem[][], acceptanceRate: number, variable: string, config: WarningConfig): Warning | null {
	let warning: Warning | null = null;;

	for(let i = 0; i < localTraces.length; i++) { 
		let localTrace = localTraces[i];

		if(localTrace.length > 10 && !localTrace.slice(-10).filter(x => x.accepted).length) {
			return {
				severity: 10,
				warning: {
					typ: WarningType.TraceStuckWarning,
					variable: variable,
					currentRate: acceptanceRate,
					causes: [],
					chain: i
				} as TraceStuckWarning
			} as Warning;
		} else if(isFinite(acceptanceRate) && acceptanceRate < config.AcceptanceRateThreshold) {
			warning = {
				severity: Math.min(Math.round(1 / (2 * acceptanceRate)), 5),
				warning: {
					typ: WarningType.AcceptanceRateWarning,
					variable: variable,
					currentRate: acceptanceRate,
					causes: [],
					chain: i
				} as AcceptanceRateWarning
			};
		}
	}

	return warning;
}

export function checkFunnel(variable: string, baseSeverity: number, knownFunnels: any): Warning | false {
	let hasFunnel = false;
	if(!knownFunnels) {
		return false;
	}
	for(let pair of knownFunnels) {
		let v = variable.replace(/_\d+/, "").replace("_log__", "");
		let p = pair[0].name.replace(/f"/,"").replace(/f'/,"").replaceAll(/"/g,"").replaceAll(/'/g,"").replace(/_\d+/,"").replace(/_{\w+}/,"").replace("_log__", "");
		hasFunnel = v == p
		if(hasFunnel) {
			let updatedPair = JSON.parse(JSON.stringify(pair));
			updatedPair[0].name = variable;
			let parentClean: string = updatedPair[1].name.replace(/f"/,"").replace(/f'/,"").replaceAll(/"/g,"").replaceAll(/'/g,"").replace("_log__", "");
			let parentParts = parentClean.match(/(.+)(_\{.*\})/)
			let variableParts = variable.match(/(.+)(_.*)/)
			if(parentParts && variableParts) {
				parentClean = `${parentParts[1]}${variableParts[2]}`;
			}

			updatedPair[1].name = parentClean;
			
			return {
				severity: baseSeverity + 1,
				warning: {
					typ: WarningType.FunnelWarning,
					parent: updatedPair[1],
					child: updatedPair[0],
					chain: 0
				} as FunnelWarning
			};
		}
	}

	return false;
}


export enum WarningType {
	AcceptanceRateWarning,
	FunnelWarning,
	BadParamScaleWarning,
	SampleSizeWarning,
	RHatWarning,
	TraceStuckWarning,
	BurninWarning,
	AutoCorrWarning,
	UnspecificWarning
}

export type AcceptanceRateWarning = {
	typ: WarningType.AcceptanceRateWarning,
	variable: string,
	currentRate: number,
	causes: Warning[],
	chain: number
}

export type AutoCorrWarning = {
	typ: WarningType.AutoCorrWarning,
	variable: string,
	autocorr: number[]
}

export type TraceStuckWarning = {
	typ: WarningType.TraceStuckWarning,
	variable: string,
	currentRate: number,
	causes: Warning[],
	chain: number
}

export type SampleSizeWarning = {
	typ: WarningType.SampleSizeWarning,
	variable: string,
	autocorr: number[],
	ess: number
}

export type RHatWarning = {
	typ: WarningType.RHatWarning,
	variable: string,
	autocorr: number[],
	ess: number,
	rhat: number
}

export type FunnelWarning = {
	typ: WarningType.FunnelWarning,
	parent: string,
	child: string,
	chain: number
}

export type UnspecificWarning = {
	typ: WarningType.UnspecificWarning,
	msg: string
}

export type Warning = {
	severity: number,
	warning: AcceptanceRateWarning | FunnelWarning | TraceStuckWarning | AutoCorrWarning | SampleSizeWarning | RHatWarning | UnspecificWarning
};