<script lang="ts">
    import dayjs from "dayjs";
	import { StudyEventType, studyLogger } from "../store";
	import { ID_GENERATOR } from "../helper";
    import Timer from "./Timer.svelte";

	let running: number | null = null;

	function startInference() {
		let time = dayjs();
		const id = ID_GENERATOR.next().value;
		running = id;
		studyLogger.log({
			id: id,
			currentTask: $studyLogger.currentTask,
			type: StudyEventType.StartsInference,
			time,
			after: dayjs.duration(time.diff($studyLogger.studyStart)),
			info: {}
		});
	}

	function stopInference(canceled: boolean, error: boolean = false) {
		let time = dayjs();
		const oldID = running as number;
		running = null;
		let type = canceled ? StudyEventType.InferenceCancelled : StudyEventType.InferenceFinished;
		if (error) {
			type = StudyEventType.PythonError;
		}

		studyLogger.log({
			id: ID_GENERATOR.next().value,
			currentTask: $studyLogger.currentTask,
			type,
			time,
			after: dayjs.duration(time.diff($studyLogger.studyStart)),
			resolves: oldID,
			info: {}
		}); 
	}
</script>

<div class="container">
	{#if !running}
		<button on:click={startInference}>Start Inference</button>
	{:else}
	<Timer startTime={dayjs()} softMaxDuration={dayjs.duration(5, 'minutes')} maxDuration={dayjs.duration(10, 'minutes')} text="Inference">
		<div slot="inside">
			<button on:click={() => stopInference(false)}>Finished</button>
			<button on:click={() => stopInference(true)}>Cancelled</button>
			<button on:click={() => stopInference(true, true)}>Error</button>
		</div>
	</Timer>
	{/if}
</div>

<style>
	.container > button {
		background-color: hsl(0 59 70);
	}
</style>