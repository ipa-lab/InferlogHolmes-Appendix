<script lang="ts">
	import { Chart } from "chart.js/auto";
	import * as Utils from "chart.js/helpers";
	import { state } from "../stores/store";
	import {
		checkAccepted,
		type SingleDebuggingState,
	} from "../utilities/warnings";

	export let variable: string;
	export let selectedChain: number;
	export let combineVars: boolean = true;
	export let totalAcceptanceRate: boolean = false;

	let timer: NodeJS.Timeout | null = null;

	let initialized = false;

	let acceptanceRate = "0";

	function initialize() {
		initialized = true;

		if (timer != null) {
			clearInterval(timer);
			timer = null;
		}
		timer = setInterval(plot, 3000);

		plot();
	}

	let plot = () => {
		if (!$state.controller.debuggingSession || !variable) {
			return;
		}

		let algIndex =
			$state.controller.debuggingSession.alg instanceof Array
				? $state.controller.debuggingSession.alg.findIndex(
						(a) =>
							a.params.varNames &&
							a.params.varNames.includes(
								variable.replace(/_\d+/, ""),
							),
					)
				: -1;

		if (totalAcceptanceRate) {
			let localTraces = $state.controller.debuggingSession.trace.map(
				(c) =>
					c.filter((t) =>
						!t.resample_addresses
							? true
							: t.resample_addresses.includes(variable),
					),
			);
			acceptanceRate = (
				(localTraces
					.map(
						(c) =>
							c.filter((t) => checkAccepted(t, algIndex)).length /
							(c.length || 1),
					)
					.reduce((a, b) => a + b, 0) /
					localTraces.length) *
				100
			).toFixed(0);
		} else {
			const trace =
				$state.controller.debuggingSession.trace[selectedChain];
			let regex = new RegExp(`${variable}(_\\d+)?`);
			let localTrace = combineVars
				? trace.filter((t) =>
						!t.resample_addresses
							? true
							: t.resample_addresses.filter((v) => regex.test(v))
									.length > 0,
					)
				: trace.filter((t) =>
						!t.resample_addresses
							? true
							: t.resample_addresses.includes(variable),
					);
			acceptanceRate = (
				(localTrace.filter((t) => checkAccepted(t, algIndex)).length /
					localTrace.length) *
				100
			).toFixed(0);
		}
	};

	function getDebuggingRate(
		variable: string,
		algs: SingleDebuggingState | SingleDebuggingState[],
	) {
		let debugRate = 25;
		if (Array.isArray(algs)) {
			algs.forEach((alg) => {
				if (
					alg.method == "hmc" &&
					alg.params.varNames &&
					alg.params.varNames.includes(variable.replace(/_\d+/, ""))
				)
					debugRate = 60;
			});
		} else {
			if (algs.method == "hmc") debugRate = 60;
		}
		return debugRate;
	}

	let debugRate = 25;
	$: debugRate = getDebuggingRate(
		variable,
		$state.controller.debuggingSession?.alg,
	);
	$: if ($state.controller.debuggingSession && !initialized && variable)
		initialize();
	$: variable, plot();
	$: selectedChain, plot();
	$: totalAcceptanceRate, plot();
</script>

<div class="container">
	<div>
		<span style="font-weight: bold;">{variable}</span> Acceptance Rate:
	</div>
	<div class="chart-container">
		<div class="rate">{acceptanceRate}%</div>
		<div class="rate-container">
			<div class="rate-child" style="width: {acceptanceRate}%;"></div>
		</div>
		{#if parseInt(acceptanceRate) < debugRate}
			<div class="warning">!</div>
		{/if}
	</div>
</div>

<style>
	.container {
		display: flex;
		flex-direction: row;
		gap: 8px;
	}

	.warning {
		background-color: hsl(51, 99%, 63%);
		border-radius: 50%;
		padding: 2px 8px;
		margin-left: 4px;
	}
	.chart-container {
		position: relative;
		display: flex;
		justify-content: center;
	}
	.rate {
		position: absolute;
		font-weight: bold;
		color: white;
	}
	.rate-container {
		height: 1.5em;
		width: 6em;
		display: flex;
		background-color: hsl(14, 89%, 78%);
		/*max-width: calc(30vh * 1.8);*/
	}

	.rate-child {
		background-color: hsl(120, 93%, 40%);
	}
</style>
