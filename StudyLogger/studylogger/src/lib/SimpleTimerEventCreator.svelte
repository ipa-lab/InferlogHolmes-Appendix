<script lang="ts">
    import dayjs from "dayjs";
	import { StudyEventType, studyLogger } from "../store";
	import { ID_GENERATOR } from "../helper";
    import Timer from "./Timer.svelte";
    import DropDownEventCreator from "./DropDownEventCreator.svelte";
    import TextEventCreator from "./TextEventCreator.svelte";

	export let startingEvent: StudyEventType;
	export let finishingEvent: StudyEventType;
	export let nonCancelingEvents: {evt: StudyEventType, name: string, typ: "click" | "str" | "list", value?: string[]}[] = [];
	export let text: string;

	let running: number | null = null;

	function startDocs() {
		let time = dayjs();
		const id = ID_GENERATOR.next().value;
		running = id;
		studyLogger.log({
			id: id,
			currentTask: $studyLogger.currentTask,
			type: startingEvent,
			time,
			after: dayjs.duration(time.diff($studyLogger.studyStart)),
			info: {}
		});
	}

	function stopDocs() {
		let time = dayjs();
		const oldID = running as number;
		running = null;

		studyLogger.log({
			id: ID_GENERATOR.next().value,
			currentTask: $studyLogger.currentTask,
			type: finishingEvent,
			time,
			after: dayjs.duration(time.diff($studyLogger.studyStart)),
			resolves: oldID,
			info: {}
		}); 
	}

	function nonCancelingLog(type: StudyEventType, value?: string) {
		const info = value ? {value} : {};
		let time = dayjs();
		studyLogger.log({
			id: ID_GENERATOR.next().value, 
			currentTask: $studyLogger.currentTask, 
			type: type, 
			time: time, 
			after: dayjs.duration(time.diff($studyLogger.studyStart)), 
			info: info
		})
	}
</script>

<div class="container">
	{#if !running}
		<button on:click={startDocs}>Starts {text}</button>
	{:else}
	<Timer startTime={dayjs()} softMaxDuration={dayjs.duration(2, 'minutes')} maxDuration={dayjs.duration(100, 'minutes')} text={text}>
		<div slot="inside">
			<div class="different">
			{#each nonCancelingEvents as evt}
				{#if evt.typ === "click"}
					<button on:click={() => nonCancelingLog(evt.evt)}>{evt.name}</button>
				{:else if evt.typ === "str"}
					<TextEventCreator eventType={evt.evt} />
				{:else}
					<DropDownEventCreator options={evt.value} eventType={evt.evt} />
				{/if}
			{/each}
			</div>
			<button on:click={() => stopDocs()}>Finished</button>
		</div>
	</Timer>
	{/if}
</div>

<style>
	.container > button {
		background-color: hsl(200 59 60);
	}
	.different {
		margin: 8px;
		padding: 8px 0;
		border-bottom: 1px solid black;
	}
</style>