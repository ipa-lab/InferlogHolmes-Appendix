<script lang="ts">
import { state } from "../stores/store";
    import { acf, getTraceValues, multiChainACF, rankNormalizedRHat } from "../utilities/helper";
    import { checkFunnel, enumerate, type FunnelWarning, type Warning } from "../utilities/warnings";
import AcceptanceRate from "./AcceptanceRate.svelte";
    import AutoCorrelationPlot from "./AutoCorrelationPlot.svelte";
    import EssOtChart from "./EssOTChart.svelte";
import Histogram from "./Histogram.svelte";
    import PairPlot from "./PairPlot.svelte";
import TraceChart from "./TraceChart.svelte";


export let variable: string;
export let selectedChain: number;
export let combineVars: boolean = true;

let autoCorrelation = []

let funnelWarningRAW: Warning | false = checkFunnel(variable, 0, $state.controller.funnel);
let funnelWarning: FunnelWarning | false = funnelWarningRAW ? funnelWarningRAW.warning as FunnelWarning : false;

$: chains = [...enumerate($state.controller?.debuggingSession?.chains ?? 1)]
$: autoCorrelation = $state.stats.length && $state.stats[$state.stats.length-1][variable]?.acf?.length != null ? $state.stats[$state.stats.length-1][variable].acf : []

</script>

<div class="container">
	{#if $state.controller.debuggingSession?.trace.length}
	<AcceptanceRate variable={variable} selectedChain={selectedChain} totalAcceptanceRate={true}></AcceptanceRate>
	RHAT: {$state.stats.length? $state.stats[$state.stats.length-1][variable]?.rHat : "N/A"}
	{/if}

	{#if funnelWarning}
	<div class="backlight-orange">
		<p>A potential funnel between {funnelWarning.parent.name} {"->"} {funnelWarning.child.name} was discovered. If this leads to inference problems you can check the warning page for help.</p>
	</div>
	<div class="chart-grid">
		{#each chains as chain}
		<PairPlot variable1={funnelWarning.parent.name} variable2={funnelWarning.child.name} selectedChain={chain}></PairPlot>
		{/each}
	</div>
	
	{/if}

	<div class="chart-grid">
		{#each chains as chain}
			<TraceChart variable={variable} selectedChain={chain} combineVars={combineVars}></TraceChart>
		{/each}
		{#each chains as chain}
			<Histogram variable={variable} selectedChain={chain} combineVars={combineVars} rankplot={true} inGrid={true}></Histogram>
		{/each}
		{#each chains as chain}
			<Histogram variable={variable} selectedChain={chain} combineVars={combineVars} rankplot={false} inGrid={true}></Histogram>
		{/each}
		<AutoCorrelationPlot autocorr={autoCorrelation}></AutoCorrelationPlot>
		<EssOtChart variable={variable}></EssOtChart>
	</div>
</div>

<style>

	.backlight-orange {
		background-color: hsl(36, 100%, 75%, 0.7);
		padding: 8px;
		border-radius: 8px;
		color: black;
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