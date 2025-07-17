<script lang="ts">
    import dayjs from "dayjs";
	import { StudyEventType, studyLogger } from "../store";
	import { ID_GENERATOR } from "../helper";
    import Timer from "./Timer.svelte";
    import DropDownEventCreator from "./DropDownEventCreator.svelte";
    import TextEventCreator from "./TextEventCreator.svelte";

	export let issues: string[];

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

	function logging(issue: string, issueId: number) {
		time = time != null ? time : dayjs();
		const id = ID_GENERATOR.next().value;
		studyLogger.log({
			id: id,
			currentTask: $studyLogger.currentTask,
			type: StudyEventType.DiscoversIssue,
			time: time,
			after: dayjs.duration(time.diff($studyLogger.studyStart)),
			info: {
				task: $studyLogger.taskOrder[$studyLogger.currentTask].name,
				issue: issue,
				issueId: issueId
			}
		});

		value = "";
		time = null;
		select = "other";
	}
</script>

<div class="container">
	{#if time === null}
		<button on:click={startLogging}>Issue Discovered</button>
	{:else}
		<div class="container">
			<div>
				<select bind:value={select}>
					{#each issues as issue, i}
					<option value={i}>{issue}</option>
					{/each}
					<option value="other">other</option>
				</select>
			</div>
			<button on:click={() => logging(issues[select], select)}>Log</button>
			<button on:click={cancel}>Cancel Issue</button>
		</div>
	{/if}
</div>

<style>
	.container button {
		background-color: hsl(100 59 60);
	}
</style>