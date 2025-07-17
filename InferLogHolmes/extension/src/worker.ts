import { TraceItem } from "./lasappTypes";
import { DebuggingState, getStatistic, WorkerTopic } from "./warnings";

const {parentPort, workerData} = require('worker_threads');

export type WorkerMessage<T> = {
	id: number;
	data: T;
}

const state: {debuggingState: DebuggingState, knownFunnels: any} = workerData;
const essOverTime: any = {};

parentPort.onmessage = (e: {data: {id: number, topic: WorkerTopic, data: any}}) => {
	switch(e.data.topic) {
		case WorkerTopic.GetWarnings:
		case WorkerTopic.finalReport:
			let data = (e.data.data as TraceItem[][]);
			for(let i = 0; i < state.debuggingState.trace.length && i < data.length; i++) {
				state.debuggingState.trace[i].push(...data[i]);
			}

			let allTraceVars = [...new Set(state.debuggingState.trace.flatMap(c => c.flatMap(t => Object.keys(t.trace_current))) ?? [])];

			const stats: any = {

			}
			for(let variable of allTraceVars) {
				stats[variable] = getStatistic(state.debuggingState.trace, variable, state.debuggingState.alg, state.debuggingState.burnin, state.debuggingState.totalIteration, false, e.data.topic == WorkerTopic.finalReport);
			}
			
			parentPort.postMessage({id: e.data.id, data: stats});
			//return {id: e.data.id, data: warnings};
			break;
	}
};
  