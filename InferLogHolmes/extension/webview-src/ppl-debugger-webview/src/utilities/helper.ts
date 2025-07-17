import type { TraceItem } from "./lasappTypes";
import FFT from "fft.js";

export const CONSEC_NUMBER_GENERATOR = (function* (start: number = 0): Generator<number> {
	let i = start;
	while (true) {
		yield i++;
	}
})(0);

export function getTraceValues(trace: TraceItem[], variable: string, combined: boolean = true, proposed: boolean = false): number[] {
	if (combined) {
		let regex = new RegExp(`${variable}(_\\d+)?`);
		let keys = [...new Set(trace.flatMap(t => {
			let keys = Object.keys(proposed ? t.trace_proposed : t.trace_current);
			return keys.filter(k => regex.test(k.replace("_log__", "")))
		}) ?? [])]

		return trace.flatMap(t => keys.map(k => proposed ? t.trace_proposed[k] : t.trace_current[k])).filter(x => x != undefined)
	}

	let key = [...new Set(trace.flatMap(t => {
		let keys = Object.keys(proposed ? t.trace_proposed : t.trace_current);
		return keys.filter(k => k == variable || k.replace("_log__", "") == variable)
	}) ?? [])][0]

	return trace.filter(t => (proposed ? t.trace_proposed[key] : t.trace_current[key]) != undefined).map(t => proposed ? t.trace_proposed[key] : t.trace_current[key])
}

export function converges_to_after(arr: number[], target: number = 0, threshold: number = 0.1): number {
	let sums: number[] = [arr[0]];

	for (let i = 1; i < sums.length; i++) {
		sums.push(sums[i - 1] + arr[i])
	}

	let convIndex = -1;

	for (let i = 1; i < sums.length; i++) {
		let diff = Math.abs(Math.abs(sums[i] - sums[i - 1]) - target)
		if (diff < threshold) {
			if (convIndex == -1) {
				convIndex = i;
			}
		} else if (convIndex != -1) {
			convIndex = -1
		}
	}

	return convIndex
}

export function rankNormaization(chains: number[][]): number[][] {
	const nChains = chains.length;
	const nSamples = chains[0].length;

	// Flatten the chains and calculate the global rank of each sample
	const flattened = chains.flat();
	const ranks = flattened
		.map((val, idx) => [val, idx])
		.sort(([a], [b]) => a - b)
		.map(([, idx], rank) => ({ rank: rank + 1, idx }));

	// Restore the ranks to the original order
	const rankMap = ranks.sort((a, b) => a.idx - b.idx).map(({ rank }) => rank);

	// Normalize ranks to [0, 1]
	const normalizedRanks = rankMap.map(rank => (rank - 1) / (nChains * nSamples - 1));

	// Split the normalized ranks back into chains
	const normalizedChains = Array.from({ length: nChains }, (_, i) =>
		normalizedRanks.slice(i * nSamples, (i + 1) * nSamples)
	);

	return normalizedChains;
}

export function rankNormalizedRHat(chains: number[][]): number {
	/**
	 * Calculate the rank-normalized R-hat statistic for MCMC chains.
	 * 
	 * @param {number[][]} chains - A 2D array of shape [nChains, nSamples], where each row corresponds to a chain.
	 * @returns {number} The rank-normalized R-hat statistic.
	 */

	const normalizedChains = rankNormaization(chains);

	// Compute split R-hat using the rank-normalized chains
	return splitRHat(normalizedChains);
}

export function multiChainACF(chains: number[][], maxLag: number | null = null): number[] {
	const nChains = chains.length;
	const nSamples = Math.min(...chains.map(x => x.length));
	const means = chains.map(chain => chain.reduce((sum, x) => sum + x, 0) / chain.length);
	const denominator = chains.map((chain, i) => chain.reduce((sum, x) => sum + (x - means[i]) ** 2, 0));

	function autocorrelation(chain: number[], lag: number, mean: number, denominator: number) {
		const numerator = chain
			.slice(0, chain.length - lag)
			.reduce((sum, x, i) => sum + (x - mean) * (chain[i + lag] - mean), 0); 
		return numerator / denominator;
	}
	
	const avgAutocorrelations = [];
	for (let lag = 1; lag < nSamples && (!maxLag || lag < maxLag); lag++) {
		const autocorrs = chains.map((chain, i) => autocorrelation(chain, lag, means[i], denominator[i]));
		const avgAutocorr = autocorrs.reduce((sum, ac) => sum + ac, 0) / nChains;
		if (avgAutocorr < 0) break; // Truncate at the first negative autocorrelation
		avgAutocorrelations.push(avgAutocorr);
	}

	return [1,...avgAutocorrelations];
}

function nextPowerOfTwo(n) {
	return Math.pow(2, Math.ceil(Math.log2(n)));
}

function computeMean(array) {
	return array.reduce((sum, val) => sum + val, 0) / array.length;
}

export function multiChainACF_FFT(chains: number[][], maxLag: number | null = null): number[] {
	const nChains = chains.length;
	const nSamples = Math.min(...chains.map(x => x.length));

	const avgAutocorrelations = [];
	for (let lag = 1; lag < nSamples || (maxLag && lag < maxLag); lag++) {
		const autocorrs = chains.map(chain => autocorrelationFFT(chain));
		const avgAutocorr = autocorrs.reduce((sum, ac) => sum + ac, 0) / nChains;
		if (avgAutocorr < 0) break; // Truncate at the first negative autocorrelation
		avgAutocorrelations.push(avgAutocorr);
	}

	return avgAutocorrelations;
}

function autocorrelationFFT(data: number[]) {
	const N = data.length;
	const paddedSize = nextPowerOfTwo(2 * N); // Ensure the size is a power of 2
	const centeredData = new Float64Array(paddedSize).fill(0);

	// Center the signal by subtracting the mean
	const mean = computeMean(data);
	for (let i = 0; i < N; i++) {
		centeredData[i] = data[i] - mean;
	}

	// Create FFT object
	const fft = new FFT(paddedSize);

	const out = fft.createComplexArray();

	fft.realTransform(out, centeredData);

	// Compute power spectrum (element-wise square of the magnitude)
	for (let i = 0; i < out.length; i++) {
		out[i][0] = out[i][0] ** 2 + out[i][1] ** 2; // Power spectrum
		out[i][1] = 0; // Set imaginary part to zero
	}

	// Inverse FFT to compute the autocorrelation
	fft.inverseTransform(centeredData, out);

	// Use Geyer's biased normalization
	const autocorr = centeredData.slice(0, N); // Only take the first N points
	for (let i = 0; i < N; i++) {
		autocorr[i] /= N * N * 2; // Divide by N² * 2 (biased estimate)
	}

	// Normalize so that the first value (lag 0) is 1
	const ac0 = autocorr[0];
	for (let i = 0; i < N; i++) {
		autocorr[i] /= ac0;
	}

	return autocorr;
}

export function multiChainESS(avgAutocorrelations: number[], nChains: number, nSamples: number): number {
	const sumRho = avgAutocorrelations.reduce((sum, rho) => sum + rho, 0);
	const ESS = (nChains * nSamples) / (1 + 2 * sumRho);

	return ESS;
}

// Split R-hat
export function splitRHat(chains: number[][]): number {
	const nSamples = chains[0].length;

	const halfSamples = Math.floor(nSamples / 2);
	const splitChains = chains.flatMap(chain => [
		chain.slice(0, halfSamples),
		chain.slice(halfSamples)
	]);

	const nSplitChains = splitChains.length;
	const nSplitSamples = splitChains[0].length;

	function variance(data: number[]): number {
		const mean = data.reduce((sum, x) => sum + x, 0) / data.length;
		return data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (data.length - 1);
	}

	const withinChainVariances = splitChains.map(chain => variance(chain));
	const W = withinChainVariances.reduce((sum, v) => sum + v, 0) / nSplitChains;

	const splitMeans = splitChains.map(chain =>
		chain.reduce((sum, x) => sum + x, 0) / chain.length
	);

	const meanOfSplitMeans =
		splitMeans.reduce((sum, m) => sum + m, 0) / nSplitChains;
	const B =
		nSplitSamples *
		splitMeans.reduce(
			(sum, m) => sum + (m - meanOfSplitMeans) ** 2,
			0
		) /
		(nSplitChains - 1);

	const VHat = ((nSplitSamples - 1) / nSplitSamples) * W + (B / nSplitSamples);

	return Math.sqrt(VHat / W);
}

export function effectiveSampleSize(autoCorr: number[], numSamples: number): number {
	return numSamples / (1 + 2 * takeWhile(autoCorr, (x) => x > 0).reduce((a, b) => a + b, 0))
}

export function takeWhile<T>(arr: T[], fn: ((x: T) => boolean)): T[] {
	let i = 0;

	while (i < arr.length && fn(arr[i])) {
		i += 1;
	}

	return arr.slice(0, i + 1)
}

export function acf(trace: number[], maxLag: number | null = null): number[] {
	let avg = mean(trace);
	let result: number[] = [];

	maxLag = maxLag != null && maxLag < trace.length / 2 ? maxLag : trace.length / 2

	for (let t = 1; t < maxLag; t++) {
		let n = 0;
		let d = 0;

		for (let i = 0; i < trace.length; i++) {
			let xim = trace[i] - avg;
			n += xim * (trace[(i + t) % trace.length] - avg);
			d += xim * xim;
		}

		result.push(n / d)
	}

	return result
}

function mean(trace: number[]): number {
	return trace.reduce((a, b) => a + b, 0) / trace.length
}