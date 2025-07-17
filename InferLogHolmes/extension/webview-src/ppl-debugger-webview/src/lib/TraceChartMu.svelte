<script lang="ts">
	import uPlot from "uplot";
	import UplotSvelte from 'uplot-svelte';
	import { state } from "../stores/store";
	import {
		CONSEC_NUMBER_GENERATOR,
		getTraceValues,
	} from "../utilities/helper";
	import { onDestroy } from "svelte";

	export let variable: string;
	export let selectedChain: number;
	export let combineVars = true;
	export let proposed = false;

	let traceGraph: HTMLElement | null = null;
	let traceChart: uPlot | null = null;

	let timer: NodeJS.Timeout | null = null;

	let initialized = false;
	let data: number[][] | null = null;
	let options: uPlot.Options | null = null

	onDestroy(() => {
		if (timer != null) {
			clearInterval(timer);
		}
		if (traceChart != null) {
			traceChart.destroy();
			traceChart = null;
		}
	});

	function getInfo(db: any, vari: any) {
		if (!$state.controller.debuggingSession) {
			return "No debuggingsession";
		}
		if (!variable) {
			return "No variable";
		}

		const trace = $state.controller.debuggingSession.trace[selectedChain];

		return `var: ${variable};
		trace: ${getTraceValues(trace, variable, combineVars)}
		`;
	}

	let plot = () => {
		if (!$state.controller.debuggingSession || !variable) {
			return;
		}

		console.log(selectedChain);

		const trace = $state.controller.debuggingSession.trace[selectedChain];
		const labels = [...Array(trace.length).keys()].map((i) => i + 1);

		options = {
			title: `${variable} trace ${selectedChain}`,
			id: "chart1",
			class: "my-chart",
			width: 180,
			height: 140,
			series: [
				{},
				{
					// initial toggled state (optional)
					label: "Data 2",
					stroke: "blue",
					fill: "rgba(0,0,255,0.1)",
				},
			],
			scales: {
				x: {
					time: false,
					range: (u, min, max) => [
						data[0][u.valToIdx(min)],
						data[0][u.valToIdx(max)],
					],
				}
			},
		};

		data = [
			labels,
			getTraceValues(trace, variable, combineVars, proposed),
		];
	};

	function initialize() {
		initialized = true;

		if (timer != null) {
			timer = null;
		}
		timer = setInterval(plot, 3000);

		plot();
	}

	function addToBoard(vari: string, combined: boolean) {
		state.addToBoard({ variable: vari, combine: combined, graph: "trace" });
	}

	$: if ($state.controller.debuggingSession && !initialized && variable)
		initialize();

	$: combineVars, plot();
	$: selectedChain, plot();
	$: variable, plot();
</script>

<div class="chart-container">
	<div class="single-graph" bind:this={traceGraph}>
		{#if options && data}
			<UplotSvelte {options} {data} target={traceGraph}/>
		{/if}
	</div>
</div>

<style>
	.single-graph {
		height: 100%;
		width: 100%;
		/*max-width: calc(30vh * 1.8);*/
	}
</style>
