<script lang="ts">
import { state } from "../stores/store";
import AcceptanceRate from "./AcceptanceRate.svelte";
import Histogram from "./Histogram.svelte";
import TraceChart from "./TraceChart.svelte";
    import TraceChartMu from "./TraceChartMu.svelte";


export let variable: string;
export let selectedChain: number;
export let combineVars: boolean = true;
</script>

<div class="container">
	{#if $state.controller.debuggingSession?.trace.length}
	<AcceptanceRate variable={variable} {selectedChain}></AcceptanceRate>
	{/if}
	<div class="chart-grid">
		<TraceChart variable={variable} selectedChain={selectedChain} combineVars={combineVars}></TraceChart>
		<Histogram variable={variable} selectedChain={selectedChain} combineVars={combineVars}></Histogram>
	</div>
</div>

<style>
	.chart-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		padding-bottom: 8px;
		border-bottom: 1px solid black;
		margin-bottom: 8px;
	}
</style>