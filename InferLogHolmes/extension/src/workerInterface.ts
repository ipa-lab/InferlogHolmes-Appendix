import { Worker } from "worker_threads";
import * as vscode from 'vscode';
import { TraceItem } from "./lasappTypes";
import { WorkerTopic } from "./warnings";

export type WorkerMessage<T> = {
	id: number;
	data: T;
}

export class WorkerInterface {
	worker: Worker;
	mId: number;
	pendingRequests: [number, ((data: any) => void)][]

	constructor(context: vscode.ExtensionContext, workerData: any) {
		this.worker = new Worker(vscode.Uri.joinPath(context.extensionUri, './out/worker.js').fsPath, {workerData});
		this.mId = 0;
		this.pendingRequests = []
		this.worker.on('message', (data: WorkerMessage<any>) => {
			let idx = this.pendingRequests.findIndex((x) => x[0] == data.id);
			if(idx != -1) {
				this.pendingRequests[idx][1](data.data);
				this.pendingRequests.splice(idx, 1);
			}
		})
	}

	private async send(topic: WorkerTopic, data: any) {
		return await new Promise((resolve) => {
			this.pendingRequests.push([this.mId, resolve]);
			this.worker.postMessage({id: this.mId, topic, data});
			this.mId++;
		})
	}

	public async getNewWarnings(newTraceBatch: TraceItem[][]): Promise<any> {
		return await this.send(WorkerTopic.GetWarnings, newTraceBatch);
	}
	public async getFinalReport(newTraceBatch: TraceItem[][]): Promise<any> {
		return await this.send(WorkerTopic.finalReport, newTraceBatch);
	}
}