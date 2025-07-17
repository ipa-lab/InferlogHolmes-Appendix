<script lang="ts">
    import dayjs from "dayjs";
    import type { StudyStore } from "../store";

	let file1: HTMLInputElement;
	let file2: HTMLInputElement;

	let selectedTasks = "task1";

	const mapper = {
		"task1": 1,
		"showcase": 2,
		"task2": 3,
	}

	function combine() {
		const reader = new FileReader();
		reader.onload = function() {
			const data1 = JSON.parse(reader.result as string) as StudyStore;
			const reader2 = new FileReader();
			reader2.onload = function() {
				const data2 = JSON.parse(reader2.result as string) as StudyStore;
				//@ts-ignore
				let maxT = mapper[selectedTasks];
				const combined = Object.assign({}, data1);
				combined.studyStart = dayjs(data1.studyStart);
				combined.events = combined.events.filter((e) => e.currentTask <= maxT).map(e => {
					e.time = dayjs(e.time);
					//@ts-ignore
					e.after = dayjs.duration(e.after);
					return e;
				});
				const lastIdx = combined.events[combined.events.length-1].id;
				combined.events.push(...data2.events.filter((e) => e.currentTask > maxT).map((e, i) => {
					e.time = dayjs(e.time);
					//@ts-ignore
					e.after = dayjs.duration(e.time.diff(combined.studyStart));
					e.id = lastIdx + i + 1;
					return e;
				}));
				combined.studyEnd = data2.studyEnd;
				combined.currentTask = data2.currentTask;
				combined.currentTaskStart = data2.currentTaskStart;

				const blob = new Blob([JSON.stringify(combined)], {type: "application/json"});
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = "combined.json";
				a.click();
				URL.revokeObjectURL(url);
			}
			reader2.readAsText(file2.files[0]);
		}
		reader.readAsText(file1.files[0]);
	}
</script>

<div>
	<div class="file-upload-container">
		<input
			type="file"
			id="file-upload1"
			accept=".json"
			bind:this={file1}
		/>
		<label for="file-upload1">trace1</label>
	</div>
	<div class="file-upload-container">
		<input
			type="file"
			id="file-upload2"
			accept=".json"
			bind:this={file2}
		/>
		<label for="file-upload2">trace2</label>
	</div>

	<select bind:value={selectedTasks}>
		<option value="task1">After Task1</option>
		<option value="task1">After Showcase</option>
		<option value="task2">After Task2</option>
	</select>

	<button on:click={() => combine()}>Combine</button>
</div>