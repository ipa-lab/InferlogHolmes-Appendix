import { acfFFT } from "./fourier";
import type { TraceItem } from "./lasappTypes";

export const CONSEC_NUMBER_GENERATOR = (function* (start: number = 0): Generator<number> {
	let i = start;
	while (true) {
		yield i++;
	}
})(0);

function escapeRegExp(str: string) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function replaceAll(str: string, find: string, replace: string) {	
	return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

export function getTraceValues(trace: TraceItem[], variable: string, combined: boolean = true, proposed: boolean = false): number[] {
	if (combined) {
		let regex = new RegExp(`${variable}(_\\d+)?`);
		let keys = [...new Set(trace.flatMap(t => {
			let keys = Object.keys(proposed ? t.trace_proposed : t.trace_current);
			return keys.filter(k => regex.test(k))
		}) ?? [])]

		return trace.flatMap(t => keys.map(k => proposed ? t.trace_proposed[k] : t.trace_current[k])).filter(x => x != undefined)
	}

	return trace.filter(t => (proposed ? t.trace_proposed[variable] : t.trace_current[variable]) != undefined).map(t => proposed ? t.trace_proposed[variable] : t.trace_current[variable])
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
	const nSamples = Math.min(...chains.map(c => c.length));

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

export function multiChainACF(chains: number[][], maxLag: number | null = null, exact: boolean = false): number[] {
	//if(exact) {
	//	let acfs = chains.map(c => acfFFT(c));
	//	let avg = acfs.map(acf => acf.reduce((a, b) => a + b, 0) / acf.length);
	//	return maxLag && maxLag < avg.length ? avg.slice(0, maxLag) : avg;
	//}

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
	let breakCondition = false;
	for (let lag = 1; lag < nSamples && (!maxLag || lag < maxLag); lag++) {
		const autocorrs = chains.map((chain, i) => autocorrelation(chain, lag, means[i], denominator[i]));
		const avgAutocorr = autocorrs.reduce((sum, ac) => sum + ac, 0) / nChains;
		if (avgAutocorr < 0) {
			breakCondition = true; // Truncate at the first negative autocorrelation
		}; 
		if(breakCondition && lag >= 20) break;
		
		avgAutocorrelations.push(avgAutocorr);
	}

	return [1,...avgAutocorrelations];
}

function nextPowerOfTwo(n: number): number {
	return Math.pow(2, Math.ceil(Math.log2(n)));
}

function computeMean(array: number[]): number {
	return array.reduce((sum, val) => sum + val, 0) / array.length;
}

export function getMedian(arr: number[]): number {
	const sorted = arr.sort((a, b) => a - b);
	const mid = Math.floor(arr.length / 2);
	return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}


export function multiChainESS(avgAutocorrelations: number[], nChains: number, nSamples: number): number {
	const sumRho = avgAutocorrelations.reduce((sum, rho) => sum + rho, 0);
	const ESS = (nChains * nSamples) / (1 + 2 * sumRho);

	return ESS;
}

export function slidingRHat(chain: number[], windowSize: number): number[] {

	function internalRhat(chains: Float64Array[], varCoeffs: [number, number][], sums: number[]) {
		const meansAndVars = chains.map((chain, i) =>{
			const mean = sums[i] / chain.length;
			const variance = (varCoeffs[i][0] - varCoeffs[i][1] * mean + chain.length * mean**2) / (chain.length - 1);

			return [mean, variance]
		});

		const [meanOfSplitMeans, W] = meansAndVars.reduce(([meanSum, varSum], [mean, variance]) => [meanSum + mean, varSum + variance], [0, 0]).map(x => x / chains.length);

		const B =
			nSplitSamples *
			meansAndVars.reduce(
				(sum, [m]) => sum + (m - meanOfSplitMeans) ** 2,
				0
			) /
			(nSplitChains - 1);

		const VHat = ((nSplitSamples - 1) / nSplitSamples) * W + (B / nSplitSamples);
		return Math.sqrt(VHat / W);
	}

	const nSamples = chain.length;

	const rankNormalizedChain = rankNormaization([chain])[0];

	const typedArray = Float64Array.from(rankNormalizedChain);

	const halfSamples = Math.floor(windowSize / 2);
	const splitChains = [
		typedArray.subarray(0, halfSamples),
		typedArray.subarray(halfSamples, windowSize)
	];

	const nSplitChains = splitChains.length;
	const nSplitSamples = splitChains[0].length;

	let varianceCoeffs = splitChains.map(window => window.reduce(([a, b], x) => [a + x**2, b + 2*x], [0,0]))
	let sums = splitChains.map(window => window.reduce((a, b) => a + b, 0));

	const rHats = [internalRhat(splitChains, varianceCoeffs as any, sums)];

	for(let start = 1; start + windowSize < nSamples; start++) {
		const out = splitChains.map(window => window[0]);

		splitChains[0] = typedArray.subarray(start, start + halfSamples);
		splitChains[1] = typedArray.subarray(start + halfSamples, start + windowSize);

		sums = sums.map((oldSum, i) => oldSum - out[i] + splitChains[i][splitChains[i].length - 1]);
		varianceCoeffs = varianceCoeffs.map((oldVar, i) => [oldVar[0] - out[i]**2 + splitChains[i][splitChains[i].length - 1]**2, oldVar[1] - 2*out[i] + 2*splitChains[i][splitChains[i].length - 1]]);
		
		rHats.push(internalRhat(splitChains, varianceCoeffs as any, sums));
	}

	return rHats;
}
// Split R-hat
export function splitRHat(chains: number[][]): number {
	const nSamples = Math.min(...chains.map(c => c.length));

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