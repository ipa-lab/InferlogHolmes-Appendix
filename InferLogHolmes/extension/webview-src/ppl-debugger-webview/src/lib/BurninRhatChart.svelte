<script lang="ts">
	import { Chart, ChartConfiguration } from "chart.js/auto";
	import * as Utils from "chart.js/helpers";
	import { state } from "../stores/store";
	import { CONSEC_NUMBER_GENERATOR, getTraceValues } from "../utilities/helper";
    import { onDestroy } from "svelte";
	import annotationPlugin from 'chartjs-plugin-annotation';

	Chart.register(annotationPlugin);

	export let variable: string;
	export let rhats: {draw: number, rhat: number}[];
	export let selectedChain: number = 0;
	export let rhatThreshold: number = 1.01;

	let traceGraph: HTMLElement | null = null;
	let traceChart: Chart | null = null;

	let timer: NodeJS.Timeout | null = null;

	let initialized = false;

	onDestroy(() => {
		if (timer != null) {
			clearInterval(timer);
		}
		if(traceChart != null) {
			traceChart.destroy();
			traceChart = null;
		}
	});

	let plot = () => {
		if (!$state.controller.debuggingSession || !variable) {
			return;
		}

		let datasets = [
			{
				label: `${variable} partial-chain-RHat Chain ${selectedChain}`,
				data: rhats.map(d => d.rhat),
				fill: false,
				borderColor: "rgb(75, 192, 192)",
				tension: 0.1,
				pointStyle: false,
				borderWidth: 1
			},
		];

		let data = {
			labels: rhats.map(d => d.draw),
			datasets,
		};

		let config: ChartConfiguration = {
			type: "line",
			data: data,
			options: {
				animation: {
					duration: 0,
				},
				plugins: {
					annotation: {
      					annotations: [{
      					  type: 'line',
      					  xMin: 0,
						  xMax: rhats.length,
						  yMin: rhatThreshold,
						  yMax: rhatThreshold,
      					  value: rhatThreshold,
      					  borderColor: 'rgb(255, 62, 62)',
      					  borderWidth: 1,
      					  label: {
      					    content: '<= 1.01',
							display: true,
							position: 'end',
							opacity: 0.6,
							backgroundColor: 'rgb(0,0,0,0)',
							color: 'rgb(255, 62, 62)',
      					  }
      					}]
    				}
				}
				
			}
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

	$: if ($state.controller.debuggingSession && !initialized && variable)
		initialize();
	
	$: selectedChain, plot()
	$: variable, plot()
	$: rhats, plot()
</script>

<div class="chart-container">
	<div class="single-graph">
		<canvas 
			bind:this={traceGraph} 
			style="width: 100%; height: 100%;"
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
