<script lang="ts">
	import { Chart, type ChartConfiguration } from "chart.js/auto";
	import * as Utils from "chart.js/helpers";
	import { state } from "../stores/store";
	import {
		CONSEC_NUMBER_GENERATOR,
		getTraceValues,
	} from "../utilities/helper";
	import TraceWorker from "../workers/trace.worker?worker"//&inline";
	import { onDestroy } from "svelte";
    import ChartWorkerWrapper from "../workers/ChartWorkerWrapper";

	export let variable: string;
	export let selectedChain: number;
	export let combineVars = true;
	export let proposed = false;

	let traceGraph: HTMLCanvasElement | null = null;
	let cv: null | any = null;
	let traceChart: string | null = null;

	const resizeObserver = new ResizeObserver((entries) => {
		for (const entry of entries) {
			const cr = entry.contentRect;
			if (traceChart != null) {
				//(entry.target as HTMLCanvasElement).width = cr.width;
				//(entry.target as HTMLCanvasElement).height = cr.height;
				setTimeout(() => {
					console.log(cr.width, cr.height);
					worker?.resize(cr.width, cr.height);
				}, 10);
			}
		}
	});

	let timer: NodeJS.Timeout | null = null;

	let worker: null | ChartWorkerWrapper = null;

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

	let plot = () => {
		if (!$state.controller.debuggingSession || !variable) {
			return;
		}

		const trace = $state.controller.debuggingSession.trace[selectedChain];
		const traceVals = getTraceValues(
			trace,
			variable,
			combineVars,
			proposed,
		);

		const ARR = Float64Array.from(traceVals);

		if (traceChart == null) {
			//@ts-ignore
			traceChart = "Test";
			setTimeout(() => {
				if (cv == null) {
					//@ts-ignore
					cv = traceGraph.transferControlToOffscreen();
				}
				worker = new ChartWorkerWrapper(cv, "trace", {variable, chain: selectedChain, trace: ARR, burnin: $state.controller.debuggingSession?.burnin ?? 0});
				const size = {width: traceGraph?.offsetWidth, height: traceGraph?.offsetHeight};
				console.log(size);
				worker.resize(size?.width ?? 0, size?.height ?? 0);
				resizeObserver.observe(traceGraph);
			}, 100);
		} else {
			worker?.update({variable, chain: selectedChain, trace: ARR});
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
			style="width: 100%; height: 100%;"
			bind:this={traceGraph}
			id="traceGraph-{CONSEC_NUMBER_GENERATOR.next().value}"
		></canvas>
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
