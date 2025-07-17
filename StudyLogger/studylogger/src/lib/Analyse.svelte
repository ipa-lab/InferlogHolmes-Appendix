<script lang="ts">
	import dayjs from "dayjs";
	import { StudyEventType, type StudyStore } from "../store";
	import ApexCharts from "apexcharts";

	const studyTraces: StudyStore[] = [];
	const dataset: any[] = [];
	let chart: ApexCharts | null = null;
	const groupDataset: any[] = [];
	let visContainer: HTMLDivElement;

	function uploadTrace(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = function (e) {
			const content = e.target?.result as string;
			const trace = JSON.parse(content) as StudyStore;
			trace.studyStart = dayjs(trace.studyStart);
			trace.currentTaskStart = dayjs(trace.currentTaskStart);
			trace.studyEnd = dayjs(trace.studyEnd);
			for (const event of trace.events) {
				event.time = dayjs(event.time);
				//@ts-ignore
				event.after = dayjs.duration(event.after);
			}
			studyTraces.push(trace);
			parseData(trace);
		};
		reader.readAsText(file);
	}

	const skipableEvents = [
		StudyEventType.FinishStudy,
		StudyEventType.StartStudy,
		StudyEventType.FinishTask,
		StudyEventType.InferenceFinished,
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
	}

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

	function parseData(data: StudyStore) {
		const groupName = `${data.participant} - ${data.evaluator}`;
		const groupId = groupName;
		const groupDataset = [];
		for (const event of data.events) {
			let end: number | undefined = event.time.toDate().getTime();
			let subgroup: undefined | string = "other";
			let type = "point";
			let content: string = event.type;
			let title: string | undefined = undefined;
			let color: string | undefined = undefined;

			if (skipableEvents.includes(event.type)) {
				continue;
			}

			if (event.type === StudyEventType.StartTask) {
				end = data.events
					.find(
						(e) =>
							e.type === StudyEventType.FinishTask &&
							e.currentTask === event.currentTask,
					)
					?.time.toDate()
					.getTime();
				subgroup = "task";
				content = `${event.info.task}`;
			} else if (event.type === StudyEventType.StartsInference) {
				const infernceEndTypes = [
					StudyEventType.InferenceCancelled,
					StudyEventType.InferenceFinished,
					StudyEventType.PythonError,
				];
				end = data.events
					.find(
						(e) =>
							infernceEndTypes.includes(e.type) &&
							e.resolves === event.id,
					)
					?.time.toDate()
					.getTime();
				type = "range";
				type = "Inference";
				subgroup = "inference";
			} else if([StudyEventType.PythonError, StudyEventType.InferenceCancelled].includes(event.type)) {
				subgroup = "inference";
				end = event.time.add(10, "seconds").toDate().getTime();
				title = event.type;
				color = "#000000";
			} else if([StudyEventType.InferenceChanged, StudyEventType.ModelChanged].includes(event.type)) {
				subgroup = "change";
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
				title = event.info.value?.type == "other"
						? event.info.value?.value
						: event.info.value;
			} else if (event.type === StudyEventType.DiscoversIssue) {
				subgroup = "issue";
				end = event.time.add(30, "seconds").toDate().getTime();
				title =
					event.info.value?.type == "other"
						? event.info.value?.value
						: event.info.value;
				color = "#ff0000";
			} else if (event.type === StudyEventType.ResolvesIssue) {
				subgroup = "issue";
				end = event.time.add(30, "seconds").toDate().getTime();
				title =
					event.info.value?.type == "other"
						? event.info.value?.value
						: event.info.value;
				color = "#0000ff";
			} else if (event.type === StudyEventType.HelpReceived) {
				subgroup = "other";
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
			}

			const item = {
				x: subgroup,
				y: [event.time.toDate().getTime(), end],
				title: title,
				content: content,
				fillColor: color ? color : subGroupColorMatcher[subgroup] ?? "#f00",
			};
			groupDataset.push(item);
		}
		dataset.push({
			name: groupName,
			data: groupDataset,
		});
		visualize(filterData(dataset, filterGroups));
	}

	function visualize(dataset: any[]) {
		var options = {
			series: dataset,
			chart: {
				height: 600,
				type: "rangeBar",
			},
			plotOptions: {
				bar: {
					horizontal: true,
					barHeight: "80%",
					dataLabels: {
						hideOverflowingLabels: true,
					},
				},
			},
			dataLabels: {
				enabled: true,
				formatter: function (val: any, opts: any) {
					const w = opts.w;
					return (
						w.config.series[opts.seriesIndex].data?.[
							opts.dataPointIndex
						]?.content ?? ""
					);
				},
				style: {
					colors: ["#f3f4f5", "#fff"],
				},
			},
			tooltip: {
				custom: (opts: any) => {
					const w = opts.w;
					let label =
						w.config.series[opts.seriesIndex].data?.[
							opts.dataPointIndex
						]?.title ?? "";

					let seriesName = w.config.series[opts.seriesIndex].data?.[
							opts.dataPointIndex
						]?.content ?? "";

					let timediff = ""
					if(w.config.series[opts.seriesIndex].data) {
						const d = w.config.series[opts.seriesIndex].data;
						let dur = dayjs.duration(dayjs(d[opts.dataPointIndex].y[1]).diff(dayjs(d[opts.dataPointIndex].y[0])));
						timediff = `${dur.minutes()}m and ${dur.seconds()}s`
					}

					return '<div class="apexcharts-tooltip-rangebar">' +
						'<div> <span class="series-name">' +
						(seriesName ? seriesName : "") +
						"</span></div>" +
						'<div> <div class="category">' +
						label +
						' </div> <span class="value start-value">' +
							timediff + "</div>" +
						"</div>";
				},
			},
			xaxis: {
				type: "datetime",
			},
			stroke: {
				width: 1,
			},
			fill: {
				type: "solid",
				opacity: 0.6,
			},
			legend: {
				position: "top",
				horizontalAlign: "left",
			},
		};

		if (chart != null) {
			chart.destroy();
			chart = null;
		}

		chart = new ApexCharts(visContainer, options);
		chart.render();
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
	<div class="snd-container">
		<div class="vis-container">
			<div bind:this={visContainer} id="visualization"></div>
		</div>
		<div class="group-filters">
			{#each Object.keys(filterGroups) as group}
				<div>
					<input
						type="checkbox"
						name="{group}"
						bind:checked={filterGroups[group]}
						on:change={() => visualize(filterData(dataset, filterGroups))}
					/>
					<label for="{group}">{group}</label>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.container {
		display: grid;
		grid-template-rows: 5% 95%;
		height: 100vh;
		width: 100%;
	}

	.snd-container {
		display: flex;
	}

	#visualization {
		width: 600px;
		height: 400px;
		border: 1px solid lightgray;
	}
</style>
