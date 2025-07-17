import type { TraceItem } from "./lasappTypes";

export type PlottingData = {
	trace: {x: number, y: number}[][],
	acceptanceRate: number[],
	histogram: HistogramPlot,
	rankNormalized: number[][],
}

export type HistogramPlot = {
	min: number[],
	max: number[],
	data: number[][]
}

export type VariablePlottingData = {
	[key: string]: PlottingData
}

export function preparePlottingData(chains: TraceItem[][]) {
	
}