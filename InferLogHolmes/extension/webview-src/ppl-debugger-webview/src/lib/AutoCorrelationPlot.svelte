<script lang="ts">
	import { Chart } from "chart.js/auto";
	import * as Utils from "chart.js/helpers";
	import { state } from "../stores/store";

	export let autocorr: number[];

	let autocorrGraph: HTMLElement | null = null;
	let autocorrChart: Chart | null = null;

	let timer: NodeJS.Timeout | null = null;

	let initialized = false;

	let plot = () => {
		if (!$state.controller.debuggingSession || !autocorr) {
			return;
		}

		const labels = [
			...Array(
				autocorr.length,
			).keys(),
		].map((i) => i + 1);

		let datasets = [
			{
				label: `ACF`,
				data: autocorr,
				barThickness: 1,
				fill: false,
				borderColor: "rgb(75, 192, 192)",
				backgroundColor: "rgb(75, 192, 192)",
			},
		];

		let data = {
			labels,
			datasets,
		};

		let config = {
			type: "bar",
			data: data,
			options: {
				animation: {
					duration: 0,
				},
			},
		};

		if (autocorrChart == null) {
			setTimeout(() => {
				autocorrChart = new Chart(
					autocorrGraph as HTMLCanvasElement,
					config as any,
				);
			}, 100);
		} else {
			autocorrChart.data = data;
			autocorrChart.update();
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

	$: if ($state.controller.debuggingSession && !initialized)
		initialize();
</script>

<div class="chart-container">
	<div class="single-graph">
		<canvas bind:this={autocorrGraph} id="autocorrGraph"></canvas>
	</div>
</div>

<style>
	.single-graph {
		height: 100%;
		width: 100%;
		/*max-width: calc(30vh * 1.8);*/
	}
</style>
