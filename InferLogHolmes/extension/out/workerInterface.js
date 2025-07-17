"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerInterface = void 0;
const worker_threads_1 = require("worker_threads");
const vscode = require("vscode");
const warnings_1 = require("./warnings");
class WorkerInterface {
    constructor(context, workerData) {
        this.worker = new worker_threads_1.Worker(vscode.Uri.joinPath(context.extensionUri, './out/worker.js').fsPath, { workerData });
        this.mId = 0;
        this.pendingRequests = [];
        this.worker.on('message', (data) => {
            let idx = this.pendingRequests.findIndex((x) => x[0] == data.id);
            if (idx != -1) {
                this.pendingRequests[idx][1](data.data);
                this.pendingRequests.splice(idx, 1);
            }
        });
    }
    async send(topic, data) {
        return await new Promise((resolve) => {
            this.pendingRequests.push([this.mId, resolve]);
            this.worker.postMessage({ id: this.mId, topic, data });
            this.mId++;
        });
    }
    async getNewWarnings(newTraceBatch) {
        return await this.send(warnings_1.WorkerTopic.GetWarnings, newTraceBatch);
    }
    async getFinalReport(newTraceBatch) {
        return await this.send(warnings_1.WorkerTopic.finalReport, newTraceBatch);
    }
}
exports.WorkerInterface = WorkerInterface;
//# sourceMappingURL=workerInterface.js.map