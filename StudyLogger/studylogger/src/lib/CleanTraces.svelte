<script lang="ts" context="module">
	export type EventItems = {
		x: string;
		occurance: dayjs.Dayjs;
		duration: Duration;
		title: string | undefined;
		content: string;
		fillColor: string;
		timeSinceTaskStart: Duration;
	};

	export type SubTaskSolved = {
		task: string;
		solved: boolean;
		detected?: Duration;
		after?: Duration;
	};

	export type TaskSolved = {
		task: string;
		short: string;
		id: number;
		fullySolved?: Duration;
		solved: SubTaskSolved[];
		taskStart: dayjs.Dayjs;
		taskDuration: Duration;
		statistics?: TaskStatistics;
		setupIssueDuration: Duration;
		cleanTaskDuration: Duration;
		events: EventItems[];
	};

	export type TaskStatistics = {
		inferenceCount: number;
		cancelledInferenceCount: number;
		meanInferenceTime: number;
		medianInferenceTime: number;
		setupIssueCount: number;
		totalSetupIssueDuration: number;
		removedEventCount: number;
		numberOfChangesToModel: number;
		numberOfChangesToInference: number;
		timeToFirstChange: number;
		timeToFirstInference: number;
		numberOfPlots: number;
		numberOfExternalDocs: number;
	};

	export type TransformedStore = { name: string; tasks: TaskSolved[]; removedEvents: EventItems[] }
</script>

<script lang="ts">
	import dayjs, { duration } from "dayjs";
	import { StudyEventType, type StudyStore } from "../store";
	import SingleTraceEdit from "./SingleTraceEdit.svelte";
	import type { Duration } from "dayjs/plugin/duration";
    import Study from "./Study.svelte";

	let dataset: TransformedStore[] = [];

	function uploadTrace(e: any) {
		const file = e.target.files[0];
		const reader = new FileReader();
		reader.onload = (e) => {
			// @ts-ignore
			const content = e.target.result;
			const trace = JSON.parse(content as any);
			trace.studyStart = dayjs(trace.studyStart);
			trace.events = (trace.events as any[])
				.map((e) => {
					e.time = dayjs(e.time);
					//@ts-ignore
					e.after = dayjs.duration(e.after);
					return e;
				})
				.toSorted((a, b) => a.time.diff(b.time));
			parseData(trace);
		};
		reader.readAsText(file);
	}

	function loadCleanTrace(e: any) {
		const file = e.target.files[0];
		const reader = new FileReader();
		reader.onload = (e) => {
			// @ts-ignore
			const content = e.target.result;
			const cleanTrace = JSON.parse(content as any) as TransformedStore;
			cleanTrace.tasks = cleanTrace.tasks.map((task) => {
				task.taskStart = dayjs(task.taskStart);
				task.taskDuration = dayjs.duration(dayjs.duration(task.taskDuration).asMilliseconds());
				task.setupIssueDuration = dayjs.duration(dayjs.duration(task.setupIssueDuration).asMilliseconds());
				task.cleanTaskDuration = dayjs.duration(dayjs.duration(task.cleanTaskDuration).asMilliseconds());
				task.solved = task.solved.map(s => {
					s.detected = s.detected ? dayjs.duration(dayjs.duration(s.detected).asMilliseconds()) : undefined;
					s.after = s.after? dayjs.duration(dayjs.duration(s.after).asMilliseconds()) : undefined;
					return s;
				});
				task.fullySolved = dayjs.duration(dayjs.duration(task.fullySolved).asMilliseconds());
				task.events = task.events.map((e) => {
					e.occurance = dayjs(e.occurance);
					e.duration = dayjs.duration(dayjs.duration(e.duration).asMilliseconds());
					e.timeSinceTaskStart = dayjs.duration(dayjs.duration(e.timeSinceTaskStart).asMilliseconds());
					return e;
				});
				return task as TaskSolved;
			});
			console.log(cleanTrace)
			dataset.push(cleanTrace);
			dataset = [...dataset];
		};
		reader.readAsText(file);
	}

	const skipableEvents = [
		StudyEventType.FinishStudy,
		StudyEventType.StartStudy,
		StudyEventType.FinishTask,
		StudyEventType.InferenceFinished,
		StudyEventType.InferenceCancelled,
		StudyEventType.PythonError,
		StudyEventType.SetupIssuesResolved
	];

	function filterData(dataset: any[], filterGroups: any): any[] {
		return dataset.map((group) => {
			const data = group.data.filter((item: any) => {
				return filterGroups[item.x];
			});
			return {
				name: group.name,
				data: data,
			};
		});
	}

	const filterGroups = {
		task: true,
		inference: true,
		plots: true,
		externalDocs: true,
		quote: true,
		issue: true,
		change: true,
		other: true,
	};

	const subGroupColorMatcher: any = {
		task: "#d11141",
		inference: "#00E396",
		plots: "#00b159",
		externalDocs: "#775DD0",
		quote: "#FEB019",
		issue: "#f37735",
		change: "#FF4560",
		other: "#ffc425",
	};

	function calculateStatistics(task: TaskSolved, start: dayjs.Dayjs, end: dayjs.Dayjs, events: EventItems[], removedEvents: EventItems[]): TaskStatistics {
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

		const changesToModel = events.filter(evt => evt.x === StudyEventType.ModelChanged && evt.occurance.isBetween(start, end));
		const changesToInference = events.filter(evt => evt.x === StudyEventType.InferenceChanged && evt.occurance.isBetween(start, end));
		const firstChangeModel = changesToModel.length > 0 ? changesToModel[0].timeSinceTaskStart.asSeconds() : Infinity;
		const firstChangeInference = changesToInference.length > 0 ? changesToInference[0].timeSinceTaskStart.asSeconds() : Infinity;
		const firstChange = Math.min(firstChangeModel, firstChangeInference);
		const firstInference = inferences.length > 0 ? inferences[0].timeSinceTaskStart.asSeconds() : 0;

		const plots = events.filter(evt => evt.x === StudyEventType.PlotUsed && evt.occurance.isBetween(start, end));
		const externalDocs = events.filter(evt => evt.x === StudyEventType.DocumentationSrcUsed && evt.occurance.isBetween(start, end));

		return {
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

	function parseData(data: StudyStore) {
		const groupName = `${data.participant} - ${data.evaluator}`;
		const groupId = groupName;

		let currentTaskStart = dayjs();

		let tasksSolved: TaskSolved[] = [
			{
				task: "Task A - Linear Regression",
				short: "A",
				id: 0,
				solved: [
					{
						task: "Step Scale too large",
						solved: false,
					},
					],
				events: [],
				taskStart: dayjs(),
				taskDuration: dayjs.duration(0),
				setupIssueDuration: dayjs.duration(0),
				cleanTaskDuration: dayjs.duration(0)
			},
			{
				task: "Task B - Rotello Heit",
				short: "B",
				id: 1,
				solved: [
					{
						task: "Model typo / unconnected RVs",
						solved: false,
					},
					{
						task: "Step Scale too large",
						solved: false,
					},
					{
						task: "Too small tune + sample size",
						solved: false,
					},
					],
				events: [],
				taskStart: dayjs(),
				taskDuration: dayjs.duration(0),
				setupIssueDuration: dayjs.duration(0),
				cleanTaskDuration: dayjs.duration(0)
			},
			{
				task: "Task C - Eight Schools",
				short: "C",
				id: 2,
				solved: [
					{
						task: "Reparameterize",
						solved: false,
					},
					{
						task: "Too small tune",
						solved: false,
					},
					{
						task: "(optional) disable autotuning",
						solved: false,
					},
					],
				events: [],
				taskStart: dayjs(),
				taskDuration: dayjs.duration(0),
				setupIssueDuration: dayjs.duration(0),
				cleanTaskDuration: dayjs.duration(0)
			},
		];
		const groupDataset: any[] = [];
		const removedEvents: any[] = [];
		let setupIssueDuration = dayjs.duration(0);

		for (const event of data.events) {
			let end: dayjs.Dayjs | undefined = undefined;
			let subgroup: undefined | string = event.type;
			let type = "point";
			let content: string = event.type;
			let title: string | undefined = undefined;
			let color: string | undefined = undefined;

			if (skipableEvents.includes(event.type)) {
				continue;
			}

			if (event.type === StudyEventType.StartTask) {
				let endItem = data.events.find(
					(e) =>
						e.type === StudyEventType.FinishTask &&
						e.currentTask === event.currentTask,
				);
				end = endItem?.time;
				subgroup = "task";
				currentTaskStart = event.time;
				let t = tasksSolved.findIndex(t => t.task == event.info.task)
				if (t >= 0) {
					tasksSolved[t].id = event.currentTask;
					tasksSolved[t].taskStart = event.time;
					tasksSolved[t].taskDuration = dayjs.duration(endItem?.time.diff(event.time) ?? 0);
					tasksSolved[t].cleanTaskDuration = tasksSolved[t].taskDuration;
				}
				content = `${event.info.task}`;
				setupIssueDuration = dayjs.duration(0);
			} else if (event.type === StudyEventType.StartsInference) {
				const infernceEndTypes = [
					StudyEventType.InferenceCancelled,
					StudyEventType.InferenceFinished,
					StudyEventType.PythonError,
				];
				let endItem = data.events.find(
					(e) =>
						infernceEndTypes.includes(e.type) &&
						e.resolves === event.id,
				)
				end = endItem?.time;
				content = endItem?.type == StudyEventType.PythonError ? "Error" : endItem?.type === StudyEventType.InferenceCancelled ? "Cancelled" : "Natural";
				type = "range";
				type = "Inference";
			} else if (
				[
					StudyEventType.PythonError,
					StudyEventType.InferenceCancelled,
				].includes(event.type)
			) {
				subgroup = "inference";
				title = event.type;
				color = "#000000";
			} else if (
				[
					StudyEventType.InferenceChanged,
					StudyEventType.ModelChanged,
				].includes(event.type)
			) {
				title =
					event.info.value?.type == "other"
						? event.info.value?.value
						: event.info.value;
			} else if (event.type === StudyEventType.DocumentationSrcUsed) {
				subgroup = "externalDocs";
				title =
					event.info.value?.type == "other"
						? event.info.value?.value
						: event.info.value;
			} else if (event.type === StudyEventType.PlotUsed) {
				subgroup = "plots";
				title =
					event.info.value?.type == "other"
						? event.info.value?.value
						: event.info.value;
			} else if (event.type === StudyEventType.Quote) {
				subgroup = "quote";
				title =
					event.info.value?.type == "other"
						? event.info.value?.value
						: event.info.value;
			} else if (event.type === StudyEventType.DiscoversIssue) {
				title =
					event.info.value?.type == "other"
						? event.info.value?.value
						: event.info.issue;

				if(event.info.value?.type !== "other") {
					const task = tasksSolved.find(t => t.id == event.currentTask);
					if(task) {
						const subTask = task.solved.find(s => s.task == event.info.issue);
						if(subTask) {
							subTask.detected = dayjs.duration(event.time.diff(currentTaskStart)).subtract(setupIssueDuration);
						}
					}
				}
				color = "#ff0000";
			} else if (event.type === StudyEventType.ResolvesIssue) {
				title =
					event.info.value?.type == "other"
						? event.info.value?.value
						: event.info.issue;

				if(event.info.value?.type !== "other") {
					const task = tasksSolved.find(t => t.id == event.currentTask);
					if(task) {
						const subTask = task.solved.find(s => s.task == event.info.issue);
						if(subTask) {
							subTask.solved = true;
							subTask.after = dayjs.duration(event.time.diff(currentTaskStart)).subtract(setupIssueDuration);

							if(task.solved.every(s => s.solved)) {
								task.fullySolved = dayjs.duration(event.time.diff(currentTaskStart)).subtract(setupIssueDuration);
							}
						}
					}
				}

				color = "#0000ff";
			} else if (event.type === StudyEventType.HelpReceived) {
				title =
					event.info.value?.type == "other"
						? event.info.value?.value
						: event.info.value;
			} else if (event.type === StudyEventType.Other) {
				subgroup = "other";
				title =
					event.info.value?.type == "other"
						? event.info.value?.value
						: event.info.value;
			} else if (event.type === StudyEventType.SetupIssues) {
				end = data.events.find(
					(e) =>
						e.type === StudyEventType.SetupIssuesResolved &&
						e.currentTask === event.currentTask && e.resolves === event.id,
				)?.time;

				let currentTaskIndex = tasksSolved.findIndex(t => t.id == event.currentTask);
				if(currentTaskIndex >= 0) {
					tasksSolved[currentTaskIndex].setupIssueDuration = tasksSolved[currentTaskIndex].setupIssueDuration.add(dayjs.duration(end?.diff(event.time) ?? 0));
					tasksSolved[currentTaskIndex].cleanTaskDuration = tasksSolved[currentTaskIndex].cleanTaskDuration.subtract(dayjs.duration(end?.diff(event.time) ?? 0));
				}

				let localDiff = end?.diff(event.time) ?? 0;
				event.time = event.time.add(localDiff);
				end = end?.add(localDiff);

				setupIssueDuration = setupIssueDuration.add(localDiff);
			}

			const item: EventItems = {
				x: subgroup,
				occurance: event.time.subtract(setupIssueDuration),
				duration: end
					? dayjs.duration(end.diff(event.time))
					: dayjs.duration(0),
				title: title,
				content: content,
				fillColor: color
					? color
					: (subGroupColorMatcher[subgroup] ?? "#f00"),
				timeSinceTaskStart: dayjs.duration(event.time.diff(currentTaskStart)).subtract(setupIssueDuration)
			};
			groupDataset.push(item);
		}

		const finalDataset = groupDataset.filter(item => {
			if(item.x == StudyEventType.SetupIssues) {
				return true;
			}
			const isDuringSetupIssue = groupDataset.some(event => 
				event.type === StudyEventType.SetupIssues && 
				item.occurance.isBetween(event.time, event.time.add(event.duration)) &&
				item.occurance.add(item.duration).isBetween(event.time, event.time.add(event.duration))
			);
			if (isDuringSetupIssue) {
				removedEvents.push(item);
				return false;
			}
			return true;
		});

		finalDataset.filter(item => item.x === "task" && !["Showcase Debugger", "PrePhase"].includes(item.content)).forEach(item => {
			let t = tasksSolved.find(t => t.task == item.content);
			if(t) {
				let start = item.occurance;
				let end = start.add(item.duration);
				t.statistics = calculateStatistics(t, start, end, finalDataset, removedEvents);
				t.events = finalDataset.filter(evt => evt.occurance.isBetween(start, end));
			}
		});

		dataset.push({
			name: groupName,
			tasks: tasksSolved.map(t => {
				t.id = t.id > 2 ? t.id - 1 : t.id;
				return t;
			}).toSorted((a, b) => a.id - b.id),
			removedEvents: removedEvents
		});

		console.log(dataset[dataset.length - 1]);

		dataset = [...dataset]
	}

	function removeItem(i) {
		dataset.splice(i, 1);
		dataset = [...dataset];
	}
</script>

<div class="container">
	<div class="file-upload-container">
		<input
			type="file"
			id="file-upload"
			accept=".json"
			on:change={(e) => uploadTrace(e)}
		/>
		<label for="file-upload">Upload a study trace</label>
	</div>

	<div class="file-upload-container">
		<input
			type="file"
			id="clean-file-upload"
			accept=".json"
			on:change={(e) => loadCleanTrace(e)}
		/>
		<label for="clean-file-upload">Load a clean trace</label>
	</div>

	<div class="edit-area">
		{#each dataset as store, i}
		<div>
			<button on:click={() => removeItem(i)}>Clear</button>
			<SingleTraceEdit bind:studyStore={store} />
			<p>Removed Events: {store.removedEvents.length}</p>
		</div>
		{/each}
	</div>
</div>

<style>
	.edit-area {
		display: flex;
		justify-content: center;
		gap: 10px;
	}
</style>
