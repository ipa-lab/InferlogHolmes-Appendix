<script lang="ts">
	import AutoCorrelationPlot from "./AutoCorrelationPlot.svelte";
	import { state } from "../stores/store";
	import { enumerate, HelpfulWarningBlockType, type HelpfulWarningObject, WarningType } from "../utilities/warnings";
	import AcceptanceRate from "./AcceptanceRate.svelte";
	import TraceChart from "./TraceChart.svelte";
	import PairPlot from "./PairPlot.svelte";
	import { vscode } from "../utilities/vscode";
    import Histogram from "./Histogram.svelte";
    import { PPL } from "../PPL/ppl";
    import BurninRhatChart from "./BurninRhatChart.svelte";
    import WarningBlockContainer from "./WarningBlockContainer.svelte";
    import WarningContainer from "./WarningContainer.svelte";

	let warnings: HelpfulWarningObject[][] = [];
	let newWarnings: HelpfulWarningObject[][] = [];
	let warningsChangedText: string | null = null;

	function groupBy(xs, key) {
	  return xs.reduce(function(rv, x) {
	    (rv[x[key]] = rv[x[key]] || []).push(x);
	    return rv;
	  }, {});
	};

	function getWarnings(warningsObject: HelpfulWarningObject[]): HelpfulWarningObject[][] {
		const grouped = Object.groupBy(warningsObject, (x) => x.baseVariable);
		console.log(grouped, Object.keys(grouped));
		const warnings = Object.keys(grouped).map((k) => grouped[k].toSorted((a, b) => b.severity - a.severity));
		return warnings.toSorted((a, b) => b[0].severity - a[0].severity);
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

	let collapsed: boolean[] = []  

	$: warnings = getWarnings($state.warnings);
	$: updateWarnings($state.incomingWarnings);
	$: chains = [...enumerate($state.controller?.debuggingSession?.chains ?? 1)]
	$: if(warnings.length != collapsed.length) collapsed = new Array(warnings.length).fill(false)
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
		<WarningContainer {warn} {warnings} {chains} />
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
