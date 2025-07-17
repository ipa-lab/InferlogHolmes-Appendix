<script lang="ts">
    import { StudyEventType, type StudyStore } from "../store";
    import type { TransformedStore, TaskSolved, SubTaskSolved, EventItems, TaskStatistics } from "./CleanTraces.svelte";
    import SingleEventEdit from "./SingleEventEdit.svelte";
    import dayjs from "dayjs";

	export let studyStore: TransformedStore;

	let timeAfterStart: HTMLInputElement[] = [];
	let duration: HTMLInputElement[] = [];

	function reorderEvents(task: TaskSolved) {
		task.events = task.events.sort((a, b) => a.occurance.diff(b.occurance));
		studyStore = studyStore;
		calculateStatistics(task);
	}

	function toggleSubTaskSolved(task: TaskSolved, subTask: SubTaskSolved) {
		subTask.solved = !subTask.solved;
		studyStore = studyStore;
		calculateStatistics(task);
	}

	function handleSubTaskSolvedTimeChange(task: TaskSolved, subTask: SubTaskSolved, e: any) {
		const [hours, minutes, seconds] = e.target.value.split(':');
		subTask.after = dayjs.duration({
			hours: parseInt(hours),
			minutes: parseInt(minutes),
			seconds: parseInt(seconds)
		});
		studyStore = studyStore;
		calculateStatistics(task);
	}

	function handleSubTaskDetectedTimeChange(task: TaskSolved, subTask: SubTaskSolved, e: any) {
		const [hours, minutes, seconds] = e.target.value.split(':');
		subTask.detected = dayjs.duration({
			hours: parseInt(hours),
			minutes: parseInt(minutes),
			seconds: parseInt(seconds)
		});
		studyStore = studyStore;
		calculateStatistics(task);
	}

	function handleFullySolvedTimeChange(task: TaskSolved, e: any) {
		const [hours, minutes, seconds] = e.target.value.split(':');
		task.fullySolved = dayjs.duration({
			hours: parseInt(hours),
			minutes: parseInt(minutes),
			seconds: parseInt(seconds)
		});
		studyStore = studyStore;
		calculateStatistics(task);
	}

	function deleteEvent(task: TaskSolved, eventToDelete: EventItems) {
		task.events = task.events.filter(evt => evt !== eventToDelete);
		task = task;
		studyStore = studyStore;
		calculateStatistics(task);
	}

	function addEventAfter(task: TaskSolved, event: EventItems) {
		const newEvent: EventItems = {
			x: "New Event",
			occurance: event.occurance.add(1, 'second'),
			duration: dayjs.duration(0),
			title: "",
			content: "",
			fillColor: "#ccc",
			timeSinceTaskStart: dayjs.duration(event.occurance.diff(task.taskStart))
		};
		const index = task.events.indexOf(event);
		task.events.splice(index + 1, 0, newEvent);
		task.events = [...task.events];
		studyStore = studyStore;
		calculateStatistics(task);
	}

	function unsetSubTaskSolvedTime(task: TaskSolved, subTask: SubTaskSolved) {
		subTask.after = undefined;
		studyStore = studyStore;
		calculateStatistics(task);
	}

	function unsetFullySolvedTime(task: TaskSolved) {
		task.fullySolved = undefined;
		studyStore = studyStore;
		calculateStatistics(task);
	}

	let collapsedTasks = new Set<number>();

	function toggleTaskCollapse(taskId: number) {
		if (collapsedTasks.has(taskId)) {
			collapsedTasks.delete(taskId);
		} else {
			collapsedTasks.add(taskId);
		}
		collapsedTasks = collapsedTasks;
	}

	function calculateStatistics(task: TaskSolved) {
		const start = task.taskStart;
		const end = start.add(task.taskDuration);
		const events = task.events;
		const removedEvents: EventItems[] = [];

		const inferences = events.filter(evt => evt.x === StudyEventType.StartsInference && evt.content !== "Error" && evt.occurance.isBetween(start, end));
		const cancelledInferences = events.filter(evt => evt.x === StudyEventType.StartsInference && evt.content === "Cancelled" && evt.occurance.isBetween(start, end));
		const inferenceTimes = inferences.map(inf => inf.duration.asSeconds());
		const meanInferenceTime = inferenceTimes.reduce((a, b) => a + b, 0) / inferenceTimes.length;
		inferenceTimes.sort((a, b) => a - b);
		const medianInferenceTime = inferenceTimes.length % 2 === 0
			? (inferenceTimes[inferenceTimes.length / 2 - 1] + inferenceTimes[inferenceTimes.length / 2]) / 2
			: inferenceTimes[Math.floor(inferenceTimes.length / 2)];

		const setupIssues = events.filter(evt => evt.x === StudyEventType.SetupIssues && evt.occurance.isBetween(start, end));
		const totalSetupIssueDuration = setupIssues.reduce((total, issue) => total + issue.duration.asSeconds(), 0);

		const changesToModel = events.filter(evt => evt.x == StudyEventType.ModelChanged && evt.occurance.isBetween(start, end));
		const changesToInference = events.filter(evt => evt.x == StudyEventType.InferenceChanged && evt.occurance.isBetween(start, end));
		const firstChangeModel = changesToModel.length > 0 ? changesToModel[0].timeSinceTaskStart.asSeconds() : Infinity;
		const firstChangeInference = changesToInference.length > 0 ? changesToInference[0].timeSinceTaskStart.asSeconds() : Infinity;
		const firstChange = Math.min(firstChangeModel, firstChangeInference);
		const firstInference = inferences.length > 0 ? inferences[0].timeSinceTaskStart.asSeconds() : 0;

		const plots = events.filter(evt => (evt.x === StudyEventType.PlotUsed || evt.x === "plots") && evt.occurance.isBetween(start, end));
		const externalDocs = events.filter(evt => (evt.x === StudyEventType.DocumentationSrcUsed || evt.x === "externalDocs") && evt.occurance.isBetween(start, end));

		task.statistics = {
			inferenceCount: inferences.length,
			cancelledInferenceCount: cancelledInferences.length,
			meanInferenceTime: isNaN(meanInferenceTime) ? 0 : meanInferenceTime,
			medianInferenceTime: isNaN(medianInferenceTime) ? 0 : medianInferenceTime,
			setupIssueCount: setupIssues.length,
			totalSetupIssueDuration: totalSetupIssueDuration,
			removedEventCount: removedEvents.length,
			numberOfChangesToModel: changesToModel.length,
			numberOfChangesToInference: changesToInference.length,
			timeToFirstChange: firstChange,
			timeToFirstInference: firstInference,
			numberOfPlots: plots.length,
			numberOfExternalDocs: externalDocs.length
		};
	}

	function saveTrace() {
		const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(studyStore));
		const downloadAnchorNode = document.createElement('a');
		downloadAnchorNode.setAttribute("href", dataStr);
		downloadAnchorNode.setAttribute("download", `${studyStore.name}_trace.json`);
		document.body.appendChild(downloadAnchorNode);
		downloadAnchorNode.click();
		downloadAnchorNode.remove();
	}

	function saveCSV() {
		const csvRows = [
			[
				"name", 
				"Task",
				"order", 
				"Inference Count", 
				"Cancelled Inference Count", 
				"Mean Inference Time", 
				"Median Inference Time", 
				"Setup Issue Count", 
				"Total Setup Issue Duration", 
				"Removed Event Count", 
				"Number of Changes to Model", 
				"Number of Changes to Inference", 
				"Time to First Change", 
				"Time to First Inference", 
				"Number of Plots", 
				"Number of External Docs", 
				"Percentage of Solved Issues", 
				"Fully Solved (seconds)",
				"Total Task Time",
				"First Issue Detected",
				"First Issue Solved",
				"Second Issue Detected",
				"Second Issue Solved",
				"Third Issue Detected",
				"Third Issue Solved"
			]
		];

		studyStore.tasks.forEach(task => {
			const percentageSolved = (task.solved.filter(s => s.solved).length / task.solved.length) * 100;
			const detectionOrder = task.solved
				.filter(s => s.detected)
				.sort((a, b) => a.detected?.asSeconds() - b.detected?.asSeconds())
				.map(s => s.detected?.asSeconds().toFixed(0) || "null");

			const solvedOrder = task.solved
				.filter(s => s.after)
				.sort((a, b) => a.after?.asSeconds() - b.after?.asSeconds())
				.map(s => s.after?.asSeconds().toFixed(0) || "null");

			const fullySolvedSeconds = task.fullySolved ? task.fullySolved.asSeconds() : "null";
			csvRows.push([
				studyStore.name,
				task.short,
				task.id,
				task.statistics.inferenceCount,
				task.statistics.cancelledInferenceCount,
				task.statistics.meanInferenceTime.toFixed(2),
				task.statistics.medianInferenceTime.toFixed(2),
				task.statistics.setupIssueCount,
				task.statistics.totalSetupIssueDuration.toFixed(2),
				task.statistics.removedEventCount,
				task.statistics.numberOfChangesToModel,
				task.statistics.numberOfChangesToInference,
				task.statistics.timeToFirstChange,
				task.statistics.timeToFirstInference,
				task.statistics.numberOfPlots,
				task.statistics.numberOfExternalDocs,
				percentageSolved.toFixed(2),
				fullySolvedSeconds,
				task.cleanTaskDuration.asSeconds().toFixed(2),
				detectionOrder.length > 0 ? detectionOrder[0] : "null",
				solvedOrder.length > 0 ? solvedOrder[0] : "null",
				detectionOrder.length > 1 ? detectionOrder[1] : "null",
				solvedOrder.length > 1 ? solvedOrder[1] : "null",
				detectionOrder.length > 2 ? detectionOrder[2] : "null",
				solvedOrder.length > 2 ? solvedOrder[2] : "null"
			]);
		});

		const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
		const encodedUri = encodeURI(csvContent);
		const link = document.createElement("a");
		link.setAttribute("href", encodedUri);
		link.setAttribute("download", `${studyStore.name}_statistics.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	function addSetupIssue(task: TaskSolved, timeAfterStart: string, duration: string) {
		const [startHours, startMinutes, startSeconds] = timeAfterStart.split(':');
		const [durationHours, durationMinutes, durationSeconds] = duration.split(':');

		const issueStart = task.taskStart.add(dayjs.duration({
			hours: parseInt(startHours),
			minutes: parseInt(startMinutes),
			seconds: parseInt(startSeconds)
		}));

		const issueDuration = dayjs.duration({
			hours: parseInt(durationHours),
			minutes: parseInt(durationMinutes),
			seconds: parseInt(durationSeconds)
		});

		const issueEnd = issueStart.add(issueDuration);

		task.events.push({
			x: StudyEventType.SetupIssues,
			occurance: issueStart,
			duration: issueDuration,
			title: "Setup Issue",
			content: "Setup Issue",
			fillColor: "#f37735",
			timeSinceTaskStart: dayjs.duration(issueStart.diff(task.taskStart))
		});

		task.setupIssueDuration = task.setupIssueDuration.add(issueDuration);
		task.cleanTaskDuration = task.cleanTaskDuration.subtract(issueDuration);

		task.events.forEach(event => {
			if (event.occurance.isAfter(issueStart)) {
				event.occurance = event.occurance.subtract(issueDuration);
				event.timeSinceTaskStart = dayjs.duration(event.occurance.diff(task.taskStart));
			}
		});

		reorderEvents(task);
		calculateStatistics(task);
	}
</script>

<div class="container">
	<h2>{studyStore.name}</h2>
	<button on:click={saveTrace}>Save Trace</button>
	<button on:click={saveCSV}>Save CSV</button>
	{#each studyStore.tasks as task}
		<h3>{task.task}</h3>
		<div class="task-body">
			{#each task.solved as subTask}
				<div class="subtask-grid">
					<div>
						Task:
						{subTask.task}
					</div>
					<label>
						Solved:
						<input type="checkbox" checked={subTask.solved} on:change={() => toggleSubTaskSolved(task, subTask)} />
					</label>
					<label>
						Detected Time:
						<input type="time" step="1" value={subTask.detected ? subTask.detected.format('HH:mm:ss') : ''} on:change={(e) => handleSubTaskDetectedTimeChange(task, subTask, e)} placeholder="Detected Time" />
					</label>
					<label>
						Solved Time:
						<input type="time" step="1" value={subTask.after ? subTask.after.format('HH:mm:ss') : ''} on:change={(e) => handleSubTaskSolvedTimeChange(task, subTask, e)} placeholder="Solved Time" />
					</label>
					<button on:click={() => unsetSubTaskSolvedTime(task, subTask)}>Unset Solved Time</button>
				</div>
			{/each}
			<div>
				<label>
					Fully Solved:
					<input type="time" step="1" value={task.fullySolved ? task.fullySolved.format('HH:mm:ss') : ''} on:change={(e) => handleFullySolvedTimeChange(task, e)} placeholder="Fully Solved Time" />
				</label>
				<button on:click={() => unsetFullySolvedTime(task)}>Unset Fully Solved</button>
			</div>
			<div class="statistics">
				<h4>Statistics</h4>
				<p>Inferences Run: {task.statistics.inferenceCount}</p>
				<p>Inferences Cancelled: {task.statistics.cancelledInferenceCount}</p>
				<p>Mean Inference Time: {task.statistics.meanInferenceTime.toFixed(2)} seconds</p>
				<p>Median Inference Time: {task.statistics.medianInferenceTime.toFixed(2)} seconds</p>
				<p>Setup Issues: {task.statistics.setupIssueCount}</p>
				<p>Total Setup Issue Duration: {task.statistics.totalSetupIssueDuration.toFixed(2)} seconds</p>
				<p>Removed Events: {task.statistics.removedEventCount}</p>
				<p>Number of Changes to Model: {task.statistics.numberOfChangesToModel}</p>
				<p>Number of Changes to Inference: {task.statistics.numberOfChangesToInference}</p>
				<p>Time to First Change: {task.statistics.timeToFirstChange} seconds</p>
				<p>Time to First Inference: {task.statistics.timeToFirstInference} seconds</p>
				<p>Number of Plots: {task.statistics.numberOfPlots}</p>
				<p>Number of External Docs: {task.statistics.numberOfExternalDocs}</p>
			</div>
		</div>
	{/each}
	{#each studyStore.tasks as task, i}
	<div class="task-card">

		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="task-header" on:click={() => toggleTaskCollapse(task.id)}>
			<h3>{task.task}</h3>
			<p>Start: {task.taskStart.format("HH:mm:ss")}, Duration: {task.taskDuration.format("mm:ss")}</p>
			<p>SetupIssueDur: {task.setupIssueDuration.format("mm:ss")}, CleanDuration: {task.cleanTaskDuration.format("mm:ss")}</p>
			<button>{collapsedTasks.has(task.id) ? 'Expand' : 'Collapse'}</button>
		</div>
		<div>
			<label>
				Add Setup Issue:
				<input type="time" step="1" placeholder="Time After Start" bind:this={timeAfterStart[i]} />
				<input type="time" step="1" placeholder="Duration" bind:this={duration[i]} />
				<button on:click={() => addSetupIssue(task, timeAfterStart[i].value, duration[i].value)}>Add Setup Issue</button>
			</label>
		</div>
		{#if !collapsedTasks.has(task.id)}
		{#each task.events as evt}
			<div>
				<SingleEventEdit bind:evt={evt} reorderEvents={() => reorderEvents(task)} deleteEvent={(evt) => deleteEvent(task, evt)} calculateStatistics={() => calculateStatistics(task)} />
				<button on:click={() => addEventAfter(task, evt)}>Add Event After</button>
			</div>
		{/each}
		{/if}
	</div>
	{/each}
</div>

<style>
	.task-card {
		border: 1px solid #ccc;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 10px;
		overflow: hidden;
		padding: 1rem;
		background-color: #f0f0f0;
	}

	.task-header {
		padding: 10px;
		background-color: #f0f0f0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		cursor: pointer;
	}

	.task-body {
		padding: 10px;
	}

	.subtask-grid {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
		gap: 10px;
	}

	.statistics {
		margin-top: 10px;
		padding: 10px;
		border: 1px solid #ccc;
		border-radius: 4px;
		background-color: #f9f9f9;
	}
</style>