import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { writable } from "svelte/store";
import { ID_GENERATOR } from "./helper";

export type StudyStore = {
	participant: string;
	evaluator?: string;
	studyStart: dayjs.Dayjs;
	currentTask: number;
	studyEnd?: dayjs.Dayjs;
	currentTaskStart: dayjs.Dayjs;
	taskOrder: { name: string, includesDebugger: boolean, todos: string[] }[];
	events: StudyEvent[];
}

export type StudyEvent = {
	id: number,
	currentTask: number;
	type: StudyEventType;
	time: dayjs.Dayjs;
	after: duration.Duration;
	info: any;
	resolves?: number;
}

export enum VisualStudyEventType {
	Issue,
	Inference,
	Plot,
	
}

export enum StudyEventType {
	StartStudy = "StartStudy",
	FinishStudy = "FinishStudy",

	StartTask = "StartTask",
	FinishTask = "FinishTask",

	DiscoversIssue = "DiscoversIssue",
	ResolvesIssue = "ResolvesIssue",
	
	StartsInference = "StartsInference",
	InferenceCancelled = "InferenceCancelled",
	InferenceFinished = "InferenceFinished",
	PythonError = "PythonError",
	
	PlotUsed = "PlotUsed",

	ModelChanged = "Modelchanged",
	InferenceChanged = "InferenceChanged",
	
	UsesDebugger = "UsesDebugger",

	DocumentationSrcUsed = "DocumentationSrcUsed",
	
	SetupIssues = "SetupIssues",
	SetupIssuesResolved = "SetupIssuesResolved",
	
	Quote = "Quote",
	HelpReceived = "HelpReceived",
	Other = "Other"
}

const { subscribe, set, update } = writable<StudyStore>({
	participant: "",
	studyStart: dayjs(),
	currentTask: -1,
	currentTaskStart: dayjs(),
	taskOrder: [],
	events: []
});

export const studyLogger = {
	subscribe,
	log: (event: StudyEvent) => update(store => {
		store.events = [...store.events, event]
		return store
	}),
	withParticipant: (participant: string) => update(store => {
		store.participant = participant
		return store
	}),
	withEvaluator: (evaluator: string) => update(store => {
		store.evaluator = evaluator
		return store
	}),
	withTaskOrder: (taskOrder: { name: string, includesDebugger: boolean, todos: string[] }[]) => update(store => {
		store.taskOrder = taskOrder
		return store
	}),
	startStudy: () => update(store => {
		store.studyStart = dayjs()
		store.currentTask = 0
		store.currentTaskStart = dayjs()
		store.events = [{
			id: 0,
			currentTask: 0,
			type: StudyEventType.StartStudy,
			time: store.studyStart,
			after: dayjs.duration(0),
			info: {}
		}]

		store.events = [...store.events, {
			id: ID_GENERATOR.next().value,
			currentTask: 0,
			type: StudyEventType.StartTask,
			time: store.currentTaskStart,
			after: dayjs.duration(store.currentTaskStart.diff(store.studyStart)),
			info: {
				task: store.taskOrder[store.currentTask].name
			}
		}]
		return store
	}),
	finishStudy: () => update(store => {
		store.studyEnd = dayjs()
		store.events = [...store.events, {
			id: ID_GENERATOR.next().value,
			currentTask: store.currentTask,
			type: StudyEventType.FinishStudy,
			time: store.studyEnd,
			after: dayjs.duration(store.studyEnd.diff(store.studyStart)),
			info: {}
		}]
		return store
	}),
	nextTask: () => update(store => {
		store.currentTaskStart = dayjs()

		if(store.currentTask > -1) {
			store.events = [...store.events, {
				id: ID_GENERATOR.next().value,
				currentTask: store.currentTask,
				type: StudyEventType.FinishTask,
				time: store.currentTaskStart,
				after: dayjs.duration(store.currentTaskStart.diff(store.studyStart)),
				info: {
					task: store.taskOrder[store.currentTask].name
				}
			}];
		}

		store.currentTask++

		if(store.currentTask >= store.taskOrder.length) {
			studyLogger.finishStudy()
			return store
		}

		store.events = [...store.events, {
			id: ID_GENERATOR.next().value,
			currentTask: store.currentTask,
			type: StudyEventType.StartTask,
			time: store.currentTaskStart,
			after: dayjs.duration(store.currentTaskStart.diff(store.studyStart)),
			info: {
				task: store.taskOrder[store.currentTask].name
			}
		}]
		
		return store
	}),
	clear: () => set({
		participant: "",
		studyStart: dayjs(),
		currentTaskStart: dayjs(),
		currentTask: -1,
		taskOrder: [],
		events: []
	})
};