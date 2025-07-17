<script lang="ts">
    import dayjs from "dayjs";
	import { StudyEventType, studyLogger } from "../store";
	import { ID_GENERATOR } from "../helper";
    import Timer from "./Timer.svelte";
    import DropDownEventCreator from "./DropDownEventCreator.svelte";
    import TextEventCreator from "./TextEventCreator.svelte";

	export let evt: StudyEventType;
	export let text: string;
	export let options: string[] | null = null;

	let value: string = "";
	let select: string = "other";

	let time: dayjs.Dayjs | null = null;

	function startLogging() {
		time = dayjs();
	}
	function cancel() {
		time = null;
		value = "";
	}

	function logging() {
		time = time != null ? time : dayjs();
		const id = ID_GENERATOR.next().value;
		studyLogger.log({
			id: id,
			currentTask: $studyLogger.currentTask,
			type: evt,
			time: time,
			after: dayjs.duration(time.diff($studyLogger.studyStart)),
			info: {value}
		});

		value = "";
		time = null;
		select = "other";
	}

	function nonCancelingLog(type: StudyEventType, value?: any) {
		time = time != null ? time : dayjs();
		const info = value ? {value} : {};
		studyLogger.log({
			id: ID_GENERATOR.next().value, 
			currentTask: $studyLogger.currentTask, 
			type: type, 
			time: time, 
			after: dayjs.duration(time.diff($studyLogger.studyStart)), 
			info: info
		})


		value = "";
		time = null;
		select = "other";
	}
</script>

<div class="container">
	{#if time === null}
		<button on:click={startLogging}>{text}</button>
	{:else}
		<div class="container">
			{#if options != null}
			<div>
				<select bind:value={select}>
					{#each options as option}
					<option value={option}>{option}</option>
					{/each}
					<option value="other">other</option>
				</select>
			</div>
			{#if select === "other"}
			<input type="text" bind:value={value} />
			<button on:click={() => nonCancelingLog(evt, {type: select, value: value})}>Log</button>
			{:else}
			<button on:click={() => nonCancelingLog(evt, select)}>Log</button>
			{/if}
			<button on:click={cancel}>Cancel {text}</button>
			{:else}
			<div>
				<textarea bind:value={value}></textarea>
			</div>
			<button on:click={() => logging()}>Log</button>
			<button on:click={cancel}>Cancel {text}</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.container button {
		background-color: hsl(100 59 60);
	}
</style>