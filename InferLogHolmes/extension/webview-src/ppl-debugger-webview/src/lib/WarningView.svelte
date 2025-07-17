<script lang="ts">
	import AutoCorrelationPlot from "./AutoCorrelationPlot.svelte";
	import { state } from "../stores/store";
	import { enumerate, type Warning, WarningType } from "../utilities/warnings";
	import AcceptanceRate from "./AcceptanceRate.svelte";
	import TraceChart from "./TraceChart.svelte";
	import PairPlot from "./PairPlot.svelte";
	import { vscode } from "../utilities/vscode";
    import Histogram from "./Histogram.svelte";
    import { PPL } from "../PPL/ppl";

	let warnings: Warning[][] = [];
	let newWarnings: Warning[][] = [];
	let warningsChangedText: string | null = null;

	function getWarnings(warningsObject): Warning[][] {
		let warnings = Object.keys(warningsObject).filter(
			(x) => warningsObject[x].length != 0,
		);
		let res = [];

		console.log(warningsObject);

		for (let warning of warnings) {
			res.push(
				warningsObject[warning].toSorted(
					(a, b) => b.severity - a.severity,
				),
			);
		}

		return res.toSorted((a, b) => b[0].severity - a[0].severity);
	}

	function updateWarnings(stateWarnings) {
		if ($state.controller.debuggingSession?.trace[0].length == 0) {
			warnings = [];
			warningsChangedText = null;
			return;
		}
		newWarnings = getWarnings(stateWarnings);
		if (JSON.stringify(newWarnings) != JSON.stringify(warnings)) {
			let i =
				newWarnings.reduce((acc, val) => acc + val.length, 0) -
				warnings.reduce((acc, val) => acc + val.length, 0);
			warningsChangedText =
				i < 0
					? "There are fewer warnings now"
					: i > 0
						? "We found new Warnings"
						: "Warnings have changed";
		}
	}

	function acceptWarningsChange() {
		warningsChangedText = null;
		state.acceptWarningsChange();
	}

	warnings = getWarnings($state.warnings);

	function reparamHelper(source: string): string {
		const ppl = PPL.getPPL(source);
		return ppl.reparameterize(source);
	}

	$: warnings = getWarnings($state.warnings);
	$: updateWarnings($state.incomingWarnings);
	$: chains = [...enumerate($state.controller?.debuggingSession?.chains ?? 1)]
</script>

<div>
	<!--{JSON.stringify(warnings)}-->
	{#if warningsChangedText}
		<div class="warnings-changed">
			<span>{warningsChangedText}</span>
			<button on:click={acceptWarningsChange}>Update</button>
		</div>
	{:else if warnings.length == 0}
		<div class="no-warnings">
			<span>No Warnings</span>
		</div>
	{/if}
	{#each warnings as warn}
		<h2>{warn[0].warning.variable.replace(/_\d+/, "")}</h2>
		{#each warn as warning}
			{#if warnings.length > 1}
				<h3>{warning.warning.variable}</h3>
			{/if}
			<div class="warning">
				{#if warning.warning.typ == WarningType.AcceptanceRateWarning || warning.warning.typ == WarningType.TraceStuckWarning}
					{#if warning.warning.typ == WarningType.AcceptanceRateWarning}
						The AcceptanceRate is {warning.warning.currentRate.toFixed(
							3,
						)} is low.
						{#if warning.warning.causes.length == 0}
							The cause is currently Unknown.
						{:else}
							We identified the following possible {warning
								.warning.causes.length > 1
								? "causes"
								: "cause"}:
						{/if}
					{:else}
						The trace might be stuck. The current acceptance rate is {warning.warning.currentRate.toFixed(
							3,
						)}.
						<TraceChart
							variable={warning.warning.variable}
							combineVars={false}
							selectedChain={warning.warning.chain}
						></TraceChart>

						{#if !warning.warning.causes?.length}
							<div class="cause">
								<div>
									If the trace continues stuck it is
									recommended check your proposal functions
									and step size. Make sure that they are
									choosen sensibly according to your model.
								</div>
							</div>
						{/if}
					{/if}
					{#each warning.warning.causes as cause}
						<div class="cause">
							{#if cause.warning.typ == WarningType.SampleSizeWarning}
								<div>
									The effective Sample Size (ESS) is very
									small ({cause.warning.ess.toFixed(3)})
									compared to the total sample size. This
									means samples drawn have very low
									independence. You can see this by checking
									the autocorrelation Plot:
								</div>
								<AutoCorrelationPlot
									autocorr={cause.warning.autocorr}
								></AutoCorrelationPlot>
								<div>
									Together with the small acceptance Rate this
									suggests that your proposer stepsize might
									be too large. While a large stepsize
									generates a diverse sample set, the
									acceptance rate quite often drops. Another
									possible solution to this issue might be
									increasing the sample size. With increased
									sample size the ESS should increase as well.
								</div>
							{:else if cause.warning.typ == WarningType.FunnelWarning}
								<div>
									There is a funnel between {cause.warning
										.parent.name}
									{"->"}
									{cause.warning.child.name}, that's probably
									not completely explored by the inference
									algorithm.
								</div>
								<PairPlot
									variable1={cause.warning.parent.name}
									variable2={cause.warning.child.name}
									selectedChain={0}
								></PairPlot>
								<div>
									It might help to reparameterize your model:
								</div>
								<div class="bold">Change:</div>
								<div class="code">
									{cause.warning.child.node.source_text}
								</div>
								<div class="bold">To:</div>
								<div class="code">
									{@html reparamHelper(
										cause.warning.child.node.source_text,
									)}
								</div>
								<button
									on:click={() =>
										vscode.postMessage({
											command: "gotoline",
											data: [
												cause.warning.child.node
													.line_no - 1,
												cause.warning.child.node
													.col_offset,
												cause.warning.child.node
													.end_line_no - 1,
												cause.warning.child.node
													.end_col_offset,
											],
										})}
								>
									Show me where
								</button>
							{:else if cause.warning.typ == WarningType.RHatWarning}
							<div>
								Your Rhat value is {cause.warning.rhat.toFixed(3)}.
								An Rhat value {cause.warning.rhat >= 1.1 ? "greater than 1.1 strongly indicates" : "greater than 1.01 can be an indicator"}
								that the chains have not mixed well. 
								This can be due to a variety of reasons, such as a bad starting point, a bad 
								proposal function, or a bad model. You can check the Rank plots below to see if the 
								chains are mixing well.
							</div>
							<div class="chart-grid">
								{#each chains as chain}
									<Histogram
										variable={cause.warning.variable}
										selectedChain={chain}
										combineVars={false}
										rankplot={true}
									></Histogram>
								{/each}
							</div>
							<div>
								If the chains have mixed well you should see this by mostly uniform Rank plots.
								A non-uniform distribution in Rank plots suggests that the chains have not 
								targeted the same posterior. Other Warnings are likely to give you more information
								and suggest possible solutions.
							</div>
							{:else}
								<div>{JSON.stringify(cause)}</div>
							{/if}
						</div>
					{/each}
				{:else}
					{JSON.stringify(warning)}
				{/if}
			</div>
		{/each}
	{/each}
</div>

<style>
	div.warning {
		padding: 8px 16px;
		border-bottom: 1px solid black;
	}

	.warnings-changed {
		position: sticky;
		top: 0;
		padding: 8px 16px;
		background-color: rgb(255, 0, 0, 1);
		border-radius: 4px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	div.cause {
		padding: 8px 8px;
		background-color: rgb(255, 0, 0, 0.2);
		margin-bottom: 4px;
		border-radius: 2px;
		box-shadow: 1px 0.5px 1px 1px rbg(0, 0, 0, 0.2);
	}

	div.code {
		padding: 8px 8px;
		background-color: rgb(17, 17, 17, 0.6);
		color: white;
		border-radius: 2px;
	}

	.chart-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		padding-bottom: 8px;
		border-bottom: 1px solid black;
		margin-bottom: 8px;
	}
</style>
