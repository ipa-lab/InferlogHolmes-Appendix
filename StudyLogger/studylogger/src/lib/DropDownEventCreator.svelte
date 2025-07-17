<script lang="ts">
    import dayjs from "dayjs";
    import { ID_GENERATOR } from "../helper";
    import { studyLogger, type StudyEventType } from "../store";

	export let options: string[];
	export let eventType: StudyEventType;
	export let setTime: dayjs.Dayjs | null = null;

	let select: string = "";
	let other: string = "";

	function nonCancelingLog(type: StudyEventType, value?: any) {
		const time = setTime != null ? setTime : dayjs();
		const info = value ? {value} : {};
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
	<select bind:value={select}>
		{#each options as option}
		<option value={option}>{option}</option>
		{/each}
		<option value="other">other</option>
	</select>
	{#if select === "other"}
		<input type="text" bind:value={other} />
		<button on:click={() => nonCancelingLog(eventType, {type: select, value: other})}>Log</button>
	{:else}
		<button on:click={() => nonCancelingLog(eventType, select)}>Log</button>
	{/if}
	
</div>

<style>
</style>