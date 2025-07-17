<script lang="ts">
    import dayjs from "dayjs";
	import duration from "dayjs/plugin/duration";
    import { onMount } from "svelte";

	export let startTime: dayjs.Dayjs;
	export let softMaxDuration: duration.Duration;
	export let maxDuration: duration.Duration;
	export let text: string;
	export let headline: boolean = false;

	let currentTime = dayjs();
	let diff: duration.Duration | null = null;

	onMount(() => {
		const interval = setInterval(() => {
			currentTime = dayjs();
		}, 1000);

		return () => clearInterval(interval);
	});

	$: diff = dayjs.duration(currentTime.diff(startTime));
</script>

<div class="container">
	{#if diff}
	<div class="bar" class:headline={headline} class:soft-danger={diff.asMilliseconds() > softMaxDuration.asMilliseconds()} class:danger={diff.asMilliseconds() > maxDuration.asMilliseconds()}>
		<div style="font-size: 1.2em; font-weight: bold;">{text}</div>
		<div style="font-weight: bold;"> {diff.asMinutes() > 60 ? diff.format('HH:mm:ss') : diff.format('mm:ss')}</div>
		<div><slot name="inside"></slot></div>
	</div>
	{/if}
</div>

<style>
	.bar {
		background-color: #36a7ed;
		color: white;
		text-align: center;
		padding: 10px;
		border-radius: 4px;
	}

	.bar.headline {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		padding-right: 2rem;
		padding-left: 2rem;
	}

	.bar.soft-danger {
		background-color: #ff9800;
	}

	.bar.danger {
		background-color: #f44336;
	}
</style>