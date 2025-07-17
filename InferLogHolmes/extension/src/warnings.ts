import { config } from "process";
import { acf, effectiveSampleSize, getMedian, getTraceValues, multiChainACF, multiChainESS, rankNormaization, rankNormalizedRHat, slidingRHat, takeWhile } from "./helper";
import { type TraceItem } from "./lasappTypes"

export enum WorkerTopic {
	GetWarnings,
	finalReport
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
	filePath?: string,
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
		AcceptanceRateThreshold: 0.8,
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

type ChainStats = {
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

export function checkAccepted(t: TraceItem, idx: number) {
	return t.accepted instanceof Array ? t.accepted[idx] : t.accepted
}

export function getStatistic(chains: TraceItem[][], variable: string, algs: SingleDebuggingState | SingleDebuggingState[], burninCount: number, totalCount: number, burninTest: boolean, finalReport: boolean): ChainStats {
	algs = algs instanceof Array ? algs : [algs];
	let alg = algs instanceof Array ? algs.findIndex(a => a.params.varNames && a.params.varNames.includes(variable.replace(/_\d+/, ""))) : algs;
	alg = alg == -1 ? 0 : alg;

	const config = WARNING_CONFIG[algs[alg].method];
	const nChains = chains.length;
	const nSamples = chains.reduce((p, c) => p + c.length, 0);
	const finalChainLength = (totalCount - burninCount) * nChains;
	const includeBurnin = finalReport || !burninCount ? false : (nSamples - nChains * burninCount) < (finalChainLength / 2);
	const adjustedChains = includeBurnin ? chains : chains.map(c => c.slice(burninCount));

	let acceptanceRate = (adjustedChains.map(c => c.filter(t => checkAccepted(t, alg)).length / (c.length || 1)).reduce((a, b) => a + b, 0) / adjustedChains.length);
	acceptanceRate = Number.isFinite(acceptanceRate) ? acceptanceRate : 0;

	let isStuckChain: number | undefined = adjustedChains.findIndex(c => c.length > 10 && !c.slice(-10).filter(x => checkAccepted(x, alg)).length)
	isStuckChain = isStuckChain === -1 ? undefined : isStuckChain;

	const vals = adjustedChains.map(c => getTraceValues(c, variable, false))
	const acf = multiChainACF(vals, finalReport ? null : 100, finalReport);
	let ess = multiChainESS(takeWhile(acf, x => x >= 0), vals.length, Math.min(...vals.map(x => x.length)));
	ess = Number.isFinite(ess) ? ess : 0;

	const rHat = ess > config.RHatSplitChainESSThreshold * nChains || finalReport ? rankNormalizedRHat(vals) : undefined;
	//const burninTestResults = burninTest || finalReport ? testChainBurninFree(vals, config) : undefined;
	const burninRhatWindow = burninTest || finalReport ? slidingWindowSingleChainRHat(vals, config) : undefined;
	
	return {
		acceptanceRate,
		isStuckChain,
		ess,
		acf,
		includesBurnin: includeBurnin,
		rHat,
		rhatWindowStats: burninRhatWindow,
		drawnAt: Math.floor(chains.reduce((acc, c) => acc + c.length, 0) / nChains)
	}
}

type BurninTestResults = {
	chain: number,
	rHatLeft: number,
	rHatRight: number,
	ess: number,
}

type BurninRHatWindowStats = {
	chain: number, 
	rhatLeft: number, 
	rhatRight: number, 
	essLeft: number, 
	essRight: number, 
	rhatOW: {rhat: number, draw: number}[]
}

function slidingWindowSingleChainRHat(chains: number[][], config: WarningConfig) {
	let i = 0;

	const rhatStats: BurninRHatWindowStats[] = [];

	for(let chain of chains) {
		const chainLength = chain.length;
		const windowSize = Math.floor(chainLength * 2 / 3)

		let window = chain.slice(0, windowSize);
		const acfLeft = multiChainACF([window.slice(0, Math.floor(window.length / 2)), window.slice(Math.floor(window.length / 2))], 100, false);
		let essLeft = multiChainESS(takeWhile(acfLeft, x => x >= 0), 2, Math.floor(window.length / 2));
		essLeft = Number.isFinite(essLeft) ? essLeft : 0;

		const rhatOW: {rhat: number, draw: number}[] = slidingRHat(chain, windowSize).map((rhat, i) => ({rhat, draw: i}));

		const acfRight = multiChainACF([window.slice(0, Math.floor(window.length / 2)), window.slice(Math.floor(window.length / 2))], 100, false);
		let essRight = multiChainESS(takeWhile(acfRight, x => x >= 0), 2, Math.floor(window.length / 2));
		essRight = Number.isFinite(essRight) ? essRight : 0;

		rhatStats.push({
			chain: i,
			rhatLeft: rhatOW[0].rhat,
			rhatRight: rhatOW[rhatOW.length - 1].rhat,
			essLeft,
			essRight,
			rhatOW
		})
		i++;
	}

	return rhatStats;
}

function testChainBurninFree(chains: number[][], config: WarningConfig): BurninTestResults[] | undefined {
	const result: BurninTestResults[] = [];
	let i = 0;
	for(let chain of chains) {
		const chainLength = chain.length;
		let batches = [...Array(3).keys()].map(i => chain.slice(i * Math.floor(chainLength / 3), (i + 1) * Math.floor(chainLength / 3)));
		
		const acf = multiChainACF(batches, 100, false);
		let ess = multiChainESS(takeWhile(acf, x => x >= 0), batches.length, Math.min(...batches.map(x => x.length)));
		ess = Number.isFinite(ess) ? ess : 0;
		const rhatLeft = rankNormalizedRHat(batches.slice(0, 2));
		const rhatRight = rankNormalizedRHat(batches.slice(1, 3));

		if(ess > config.RHatSplitChainESSThreshold && rhatLeft > config.RHatThreshold &&  rhatLeft - rhatRight > 0.001) {
			result.push({
				chain: i,
				rHatLeft: rhatLeft,
				rHatRight: rhatRight,
				ess: ess
			});

			i++;
		}
	}
	return result.length ? result : undefined;
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
}