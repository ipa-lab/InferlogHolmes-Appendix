<script lang="ts">
    import { type StudyEvent, StudyEventType } from "../store";
    import dayjs from "dayjs";
    import type { EventItems } from "./CleanTraces.svelte";

	export let evt: EventItems;
	export let reorderEvents: () => void;
	export let deleteEvent: (event: EventItems) => void;
	export let calculateStatistics: () => void;

	const subGroupColorMatcher: any = {
		task: "#d11141",
		inference: "#00E396",
		plots: "#00b159",
		externalDocs: "#775DD0",
		quote: "#FEB019",
		issue: "#f37735",
		DiscoversIssue: "#f37735",
		ResolvesIssue: "#0000ff",
		change: "#FF4560",
		other: "#ffc425",
	};

	function handleTimeChange(e: any) {
		const [hours, minutes, seconds] = e.target.value.split(':');
		evt.occurance = evt.occurance.hour(parseInt(hours)).minute(parseInt(minutes)).second(parseInt(seconds));
		evt.timeSinceTaskStart = dayjs.duration(evt.occurance.diff(evt.occurance.startOf('day')));
		calculateStatistics();
	}

	function handleDurationChange(e: any) {
		const [hours, minutes, seconds] = e.target.value.split(':');
		evt.duration = dayjs.duration({
			hours: parseInt(hours),
			minutes: parseInt(minutes),
			seconds: parseInt(seconds)
		});
		calculateStatistics();
	}

	function handleTypeChanged(e: any) {
		evt.fillColor = subGroupColorMatcher[e.target.value] ?? "#000";
		calculateStatistics();
	}

	function handleTimeSinceTaskStartChange(e: any) {
		const [hours, minutes, seconds] = e.target.value.split(':');
		let old = evt.timeSinceTaskStart;
		evt.timeSinceTaskStart = dayjs.duration({
			hours: parseInt(hours),
			minutes: parseInt(minutes),
			seconds: parseInt(seconds)
		});
		evt.occurance = evt.occurance.add(evt.timeSinceTaskStart.asMilliseconds() - old.asMilliseconds(), 'ms');
		calculateStatistics();
	}
</script>

<div class="event-card">
	<div class="event-title" style="background-color: {evt.fillColor}">
		<input type="text" bind:value={evt.x} placeholder="Event Type" on:change={handleTypeChanged}/>
	</div>
	<div class="event-body">
		<div class="grid-container">
			<label for="title">Title</label>
			<input id="title" type="text" bind:value={evt.title} placeholder="Title"/>

			<label for="time">Time</label>
			<input id="time" type="time" step="1" value={evt.occurance.format('HH:mm:ss')} on:change={handleTimeChange} placeholder="Time" />

			<label for="duration">Duration</label>
			<input id="duration" type="time" step="1" value={evt.duration.format('HH:mm:ss')} on:change={handleDurationChange} placeholder="Duration" />

			<label for="timeSinceTaskStart">Time Since Task Start</label>
			<input id="timeSinceTaskStart" type="time" step="1" value={evt.timeSinceTaskStart.format('HH:mm:ss')} on:change={handleTimeSinceTaskStartChange} placeholder="Time Since Task Start" />

			<label for="content">Content</label>
			<textarea id="content" bind:value={evt.content} placeholder="Content"></textarea>
		</div>
		<button on:click={() => { deleteEvent(evt); calculateStatistics(); }}>Delete Event</button>
		<button on:click={() => { reorderEvents() }}>Reorder</button>
	</div>
</div>

<style>
	.event-card {
		border: 1px solid #ccc;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 10px;
		overflow: hidden;
	}

	.event-title {
		padding: 10px;
		color: #fff;
		font-weight: bold;
	}

	.event-body {
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.grid-container {
		display: grid;
		grid-template-columns: 1fr 2fr;
		padding: 0 1rem;
		gap: 10px;
	}

	.event-body input,
	.event-body textarea {
		width: 100%;
		padding: 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	.event-body button {
		align-self: flex-end;
		padding: 8px 16px;
		border: none;
		background-color: #ff4d4d;
		color: white;
		border-radius: 4px;
		cursor: pointer;
	}

	.event-body button:hover {
		background-color: #ff1a1a;
	}
</style>