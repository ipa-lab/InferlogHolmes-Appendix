<script lang="ts">
    import dayjs from "dayjs";
    import { ID_GENERATOR } from "../helper";
    import { studyLogger, type StudyEventType } from "../store";

	export let eventType: StudyEventType;
	export let setTime: dayjs.Dayjs | null = null;


	let other: string = "";

	function nonCancelingLog(type: StudyEventType, value?: any) {
		const info = value ? {value} : {};
		const time = setTime != null ? setTime : dayjs();
		
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
	<textarea bind:value={other}></textarea>
	<button on:click={() => nonCancelingLog(eventType, other)}>Log</button>
</div>

<style>
</style>