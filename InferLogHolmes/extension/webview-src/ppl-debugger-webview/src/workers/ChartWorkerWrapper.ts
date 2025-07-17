import TraceWorker from "../workers/trace.worker?worker&inline";

export type ChartType = "trace" | "histogram" | "rank-grid" | "acf" | "pairplot";

export default class ChartWorkerWrapper {
	private worker: Worker;
	private chartType: ChartType;

	constructor(canvas: OffscreenCanvas, chartType: "trace", data: {variable: string, chain: number, trace: Float64Array, burnin: number});
	constructor(canvas: OffscreenCanvas, chartType: "histogram", data: {variable: string, chain: number, inGrid: boolean, chains: Float64Array[]});
	constructor(canvas: OffscreenCanvas, chartType: "rank-grid", data: {variable: string, chain: number, inGrid: boolean, chains: Float64Array[]});
	constructor(canvas: OffscreenCanvas, chartType: "acf", data: {});
	constructor(canvas: OffscreenCanvas, chartType: "pairplot", data: {});
	constructor(canvas: OffscreenCanvas, chartType: ChartType, data: {variable?: string, chain?: number, inGrid?: boolean, trace?: Float64Array, chains?: Float64Array[], burnin?: number}) {
		this.worker = new TraceWorker();
		this.chartType = chartType;

		const transfer = this.getTransferables(data);

		this.init(canvas, data, transfer);
	}

	private getTransferables(data: any): Transferable[] {
		const transfer = [];
		if(this.chartType === "trace" && data.trace) {
			transfer.push(data.trace.buffer);
		} else if((this.chartType === "histogram" || this.chartType === "rank-grid") && data.chains) {
			//@ts-ignore
			transfer.push(...data.chains.map(c => c.buffer));
		}

		return transfer;
	}

	private init(canvas: OffscreenCanvas, data: any, transfer: Transferable[]) {
		this.worker.postMessage({
			type: "init", 
			chartType: this.chartType, 
			canvas: canvas, 
			data: data
		}, [canvas, ...transfer]);
	}

	public update(data: {variable: string, chain: number, trace: Float64Array}): void
	public update(data: {variable: string, chain: number, inGrid: boolean, chains: Float64Array[]}): void
	public update(data: any): void {
		const transfer = this.getTransferables(data);
		this.worker.postMessage({type: "update", chartType: this.chartType, data}, transfer);
	}

	public resize(width: number, height: number) {
		this.worker.postMessage({type: "resize", width, height});
	}

	public terminate() {
		this.worker.terminate();
	}

}