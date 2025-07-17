<script lang="ts">
	import { Chart } from "chart.js/auto";
	import * as Utils from "chart.js/helpers";
	import { state } from "../stores/store";
	import { CONSEC_NUMBER_GENERATOR, getTraceValues, rankNormaization } from "../utilities/helper";
	import { onDestroy } from "svelte";
    import ChartWorkerWrapper from "../workers/ChartWorkerWrapper";

	export let variable: string;
	export let selectedChain: number;
	export let combineVars = true;
	export let proposed = false;
	export let rankplot = false;
	export let inGrid = false;

	let traceGraph: HTMLElement | null = null;
	let cv: null | any = null;
	let traceChart: string | null = null;

	let worker: null | ChartWorkerWrapper = null;

	let timer: NodeJS.Timeout | null = null;

	let initialized = false;

	onDestroy(() => {
		if (timer != null) {
			clearInterval(timer);
		}
		if (traceChart != null) {
			worker?.terminate();
			worker = null;
			traceChart = null;
		}
	});

	export function getBinCount(values: number[]): number {
		values.sort((a, b) => a - b);

		let unique_elements = values.filter(
			(v, i, a) => a.indexOf(v) === i,
		).length;

		let numberOfBins =
			values.length / 3 > unique_elements
				? unique_elements
				: values.length / 3;

		if (numberOfBins > 20) {
			numberOfBins = 20;
		} else if (numberOfBins < 3) {
			numberOfBins = unique_elements;
		}

		numberOfBins = Math.floor(numberOfBins);

		return numberOfBins;
	}

	let plot = () => {
		if (!$state.controller.debuggingSession || !variable) {
			return;
		}

		const chains = $state.controller.debuggingSession.trace.map(trace => Float64Array.from(getTraceValues(trace, variable, combineVars, proposed)));

		if (traceChart == null) {
			//@ts-ignore
			traceChart = "Test";
			setTimeout(() => {
				if (cv == null) {
					//@ts-ignore
					cv = traceGraph.transferControlToOffscreen();
				}
				worker = rankplot 
					? new ChartWorkerWrapper(cv, "rank-grid", {variable, chain: selectedChain, inGrid: inGrid, chains: chains})
					: new ChartWorkerWrapper(cv, "histogram", {variable, chain: selectedChain, inGrid: inGrid, chains: chains});

				const size = traceGraph?.getBoundingClientRect();
				worker.resize(size?.width ?? 0, size?.height ?? 0);
			}, 100);
		} else {
			worker?.update({variable, chain: selectedChain, inGrid: inGrid, chains: chains});
		}
	};

	function initialize() {
		initialized = true;

		if (timer != null) {
			timer = null;
		}
		timer = setInterval(plot, 3000);

		plot();
	}

	$: if ($state.controller.debuggingSession && !initialized && variable)
		initialize();

	$: combineVars, plot();
	$: selectedChain, plot();
	$: variable, plot();
</script>

<div class="chart-container">
	<div class="single-graph">
		<canvas 
			style="width: 100%; height: 100%"
			bind:this={traceGraph} 
			id="traceGraph-{CONSEC_NUMBER_GENERATOR.next().value}"></canvas>
	</div>
</div>

<style>
	.chart-container {
		height: 100%;
		width: 100%;
	}
	.single-graph {
		height: 100%;
		width: 100%;
		/*max-width: calc(30vh * 1.8);*/
	}
</style>
