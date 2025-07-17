"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const warnings_1 = require("./warnings");
const { parentPort, workerData } = require('worker_threads');
const state = workerData;
const essOverTime = {};
parentPort.onmessage = (e) => {
    switch (e.data.topic) {
        case warnings_1.WorkerTopic.GetWarnings:
        case warnings_1.WorkerTopic.finalReport:
            let data = e.data.data;
            for (let i = 0; i < state.debuggingState.trace.length && i < data.length; i++) {
                state.debuggingState.trace[i].push(...data[i]);
            }
            let allTraceVars = [...new Set(state.debuggingState.trace.flatMap(c => c.flatMap(t => Object.keys(t.trace_current))) ?? [])];
            const stats = {};
            for (let variable of allTraceVars) {
                stats[variable] = (0, warnings_1.getStatistic)(state.debuggingState.trace, variable, state.debuggingState.alg, state.debuggingState.burnin, state.debuggingState.totalIteration, false, e.data.topic == warnings_1.WorkerTopic.finalReport);
            }
            parentPort.postMessage({ id: e.data.id, data: stats });
            //return {id: e.data.id, data: warnings};
            break;
    }
};
//# sourceMappingURL=worker.js.map