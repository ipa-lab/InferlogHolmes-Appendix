<script lang="ts">
    import dayjs from "dayjs";
	import { StudyEventType, studyLogger } from "../store";
	import { ID_GENERATOR } from "../helper";

	export let issue: string;
	export let issueId: number;

	let solved = false;


	function solves() {
		if(solved) return;
		solved = true;

		logIssue(StudyEventType.ResolvesIssue);
	}


	function logIssue(type: StudyEventType) {
		let time = dayjs();
		const id = ID_GENERATOR.next().value;
		studyLogger.log({
			id: id,
			currentTask: $studyLogger.currentTask,
			type: type,
			time,
			after: dayjs.duration(time.diff($studyLogger.studyStart)),
			info: {
				task: $studyLogger.taskOrder[$studyLogger.currentTask].name,
				issue: issue,
				issueId: issueId
			}
		});
	}
</script>

<div class="container">
	<div class="issue">{issue}</div>
	<div class="box-container">
		<div class="box">
			<input type="checkbox" disabled={solved} name="solved" checked={false} on:click={solves}>
			<label for="solved">Resolved</label>
		</div>
	</div>
</div>

<style>
	.container {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		gap: 8px;
  		padding: 8px 16px;
  		border: 1px solid;
	}

	.issue {
		font-weight: bold;
		text-align: left;
  		font-size: 1.2rem;
	}

	.box {
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		gap: 4px;
	}
</style>