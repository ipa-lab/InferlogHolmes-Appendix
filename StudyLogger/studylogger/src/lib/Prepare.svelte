<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	let Participant = "";
	let Evaluator = "";

	let TASKS = [
		{
			name: "PrePhase",
			includesDebugger: false,
			todos: [],
		},
		{
			name: "Task A - Linear Regression",
			includesDebugger: true,
			todos: ["Step Scale too large"],
		},
		{
			name: "Task B - Rotello Heit",
			includesDebugger: true,
			todos: [
				"Model typo / unconnected RVs",
				"Step Scale too large",
				"Too small tune + sample size",
			],
		},
		{
			name: "Task C - Eight Schools",
			includesDebugger: true,
			todos: [
				"Reparameterize",
				"Too small tune",
				"(optional) disable autotuning",
			],
		},
	];
	let taskIndices = {
		A: 1,
		B: 2,
		C: 3,
	};

	let taskOrder = "";
	let tasksInOrder: { name: string; todos: string[] }[] = [];
	function orderTasks(tasksOrder: string) {
		const ordered = [...tasksOrder.trim().toUpperCase()]
			.filter(
				(t) => t.trim() !== "" && Object.keys(taskIndices).includes(t),
			) //@ts-ignore
			.map((t) => TASKS[taskIndices[t]]);
		return [
			TASKS[0],
			...ordered.slice(0, 1).map(t => {
				t.includesDebugger = false;
				return t;
			}),
			{ name: "Showcase Debugger", todos: [] },
			...ordered.slice(1),
		];
	}

	function startStudy() {
		dispatch("startStudy", { Participant, Evaluator, tasksInOrder });
	}

	$: tasksInOrder = orderTasks(taskOrder);
</script>

<div class="container">
	<input type="text" bind:value={Evaluator} placeholder="Evaluator" />
	<input type="text" bind:value={Participant} placeholder="Participant ID" />
	<div class="tasks-preview">
		{#each tasksInOrder as task, i}
			<div>{i}. {task.name}</div>
		{/each}
	</div>
	<input type="text" bind:value={taskOrder} placeholder="ABC" />
	<button on:click={startStudy}>Start Study</button>
</div>

<style>

	.container {
		display: flex; 
		flex-direction: column; 
		align-items: center; 
		justify-content: center;
		height: 100vh;
		gap: 16px;
	} 

	.tasks-preview {
		text-align: center;
		margin: 8px 4px;
	}

	.tasks-preview div:nth-child(1) {
		font-weight: bold;
	}
	.tasks-preview div:nth-child(3) {
		font-weight: bold;
	}
</style>
