<script lang="ts">
	import { Chart } from "chart.js/auto";
	import * as Utils from "chart.js/helpers";
	import { state } from "../stores/store";
	import { getTraceValues } from "../utilities/helper";
    import { type TraceItem } from "../utilities/lasappTypes";

	export let variable1: string;
	export let variable2: string;
	export let selectedChain: number;
	export let combineVars = false;
	export let proposed = false;

	let traceGraph: HTMLElement | null = null;
	let traceChart: Chart | null = null;

	let timer: NodeJS.Timeout | null = null;

	let initialized = false;

	function getScatterData(trace: TraceItem[]): {x: number, y: number}[] {
		let a = getTraceValues(trace, variable1, combineVars, proposed);
		let b = getTraceValues(trace, variable2, combineVars, proposed);

		let res = [];

		for(let i = 0; i < Math.min(a.length, b.length); i++) {
			res.push({x: a[i], y: b[i]})
		}

		return res;
	}

	let plot = () => {
		if (!$state.controller.debuggingSession || !variable1 || !variable2) {
			return;
		}

		const trace = $state.controller.debuggingSession.trace[selectedChain];
		const labels = [
			...Array(
				$state.controller.debuggingSession.trace.length + 10,
			).keys(),
		].map((i) => i + 1);

		let datasets = [
			{
				label: `Pair Plot ${variable1} - ${variable2} Chain ${selectedChain}`,
				data: getScatterData(trace),
				backgroundColor: 'rgb(0, 255, 232)',
			},
		];

		let data = {
			labels,
			datasets,
		};

		let config = {
			type: "scatter",
			data: data,
			options: {
        		scales: {
					x: {
						type: 'linear',
						title: {
							display: true,
							text: variable1
						}
					},
        		    y: {
						title: {
							display: true,
							text: variable2
						}
					}
				},
				animation: {
					duration: 0,
				},
			},
		};

		if (traceChart == null) {
			setTimeout(() => {
				traceChart = new Chart(
					traceGraph as HTMLCanvasElement,
					config as any,
				);
			}, 100);
		} else {
			traceChart.data = data;
			traceChart.update();
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

	function addToBoard(vari: string, combined: boolean) {
		state.addToBoard({variable: vari, combine: combined, graph: 'trace'})
	}

	$: if ($state.controller.debuggingSession && !initialized && variable1 && variable2)
		initialize();
	
	$: combineVars, plot()
</script>

<div class="chart-container">
	<div class="single-graph">
		<canvas bind:this={traceGraph} id="traceGraph"></canvas>
	</div>
</div>

<style>
	.single-graph {
		height: 100%;
		width: 100%;
		/*max-width: calc(30vh * 1.8);*/
	}
</style>
