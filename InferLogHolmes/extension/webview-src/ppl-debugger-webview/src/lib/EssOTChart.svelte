<script lang="ts">
	import { Chart } from "chart.js/auto";
	import * as Utils from "chart.js/helpers";
	import { state } from "../stores/store";
	//import { ARIMA } from "arima";

	export let variable: string;

	let traceGraph: HTMLElement | null = null;
	let traceChart: Chart | null = null;

	let timer: NodeJS.Timeout | null = null;

	let initialized = false;

	let plot = () => {
		if (!$state.stats.length || !variable || !$state.stats.filter(s => s[variable]).length) {
			return;
		}

		const trace = [0, ...$state.stats.map(s => s[variable].ess)];
		const hasBurnin = $state.stats.findLastIndex(s => s[variable].includesBurnin);
		const burninIncludedTill = hasBurnin ? hasBurnin + 1 : undefined;
		const labels = [0, ...$state.stats.map(s => s[variable].drawnAt)];
		
		//const arima = new ARIMA({ p: 2, d: 1, q: 2, P: 0, D: 0, Q: 0, S: 0, verbose: false }).train(trace)
		//const [pred, errors] = arima.predict($state.controller.debuggingSession.params.totalIteration / 10 - trace.length)
		
		let annotations = hasBurnin && burninIncludedTill && burninIncludedTill > 0 ? [
        {
            type: "line",
            xMin:
				burninIncludedTill ?? 0,
            xMax:
				burninIncludedTill ?? 0,
            value: 5,
            borderColor: "rgb(255, 62, 62)",
            borderWidth: 1,
            label: {
                content: "Burnin",
                display: true,
                position: "end",
                opacity: 0.6,
                xAdjust: -20,
                yAdjust: -10,
                backgroundColor: "rgb(0,0,0,0)",
                color: "rgb(255, 62, 62)",
            },
        },
        {
            type: "box",
            xMin: 0,
            xMax:
				burninIncludedTill ?? 0,
            borderColor: "rgb(255, 62, 62, 0.1)",
            borderWidth: 0,
            backgroundColor: "rgba(255, 62, 62, 0.1)",
        },
    ] : undefined;

		console.log("ESS:", trace)

		let datasets = [
			{
				label: `${variable} ESS Over Time`,
				data: trace,
				fill: false,
				borderColor: "rgb(75, 192, 192)",
				tension: 0.1,
				pointStyle: false,
				borderWidth: 1,
			}, /*{
				label: `${variable} ESS Over Time`,
				data: [...trace, ...pred],
				fill: false,
				borderColor: "rgb(75, 192, 192)",
				borderDash: [6,6],
				tension: 0.1,
				pointStyle: false,
				borderWidth: 1,
			},*/
		];

		let data = {
			labels,
			datasets,
		};

		let config = {
			type: "line",
			data: data,
			options: {
				animation: false,
				plugins: {
					annotation: {
						annotations
					}
				}
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
			//@ts-ignore
			traceChart.options.plugins.annotation.annotations = annotations;
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
	
	$: variable, plot()
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
