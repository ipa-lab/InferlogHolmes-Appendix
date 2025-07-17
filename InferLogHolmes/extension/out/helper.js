"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acf = exports.takeWhile = exports.effectiveSampleSize = exports.splitRHat = exports.slidingRHat = exports.multiChainESS = exports.getMedian = exports.multiChainACF = exports.rankNormalizedRHat = exports.rankNormaization = exports.converges_to_after = exports.getTraceValues = exports.replaceAll = exports.CONSEC_NUMBER_GENERATOR = void 0;
exports.CONSEC_NUMBER_GENERATOR = (function* (start = 0) {
    let i = start;
    while (true) {
        yield i++;
    }
})(0);
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
function replaceAll(str, find, replace) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}
exports.replaceAll = replaceAll;
function getTraceValues(trace, variable, combined = true, proposed = false) {
    if (combined) {
        let regex = new RegExp(`${variable}(_\\d+)?`);
        let keys = [...new Set(trace.flatMap(t => {
                let keys = Object.keys(proposed ? t.trace_proposed : t.trace_current);
                return keys.filter(k => regex.test(k));
            }) ?? [])];
        return trace.flatMap(t => keys.map(k => proposed ? t.trace_proposed[k] : t.trace_current[k])).filter(x => x != undefined);
    }
    return trace.filter(t => (proposed ? t.trace_proposed[variable] : t.trace_current[variable]) != undefined).map(t => proposed ? t.trace_proposed[variable] : t.trace_current[variable]);
}
exports.getTraceValues = getTraceValues;
function converges_to_after(arr, target = 0, threshold = 0.1) {
    let sums = [arr[0]];
    for (let i = 1; i < sums.length; i++) {
        sums.push(sums[i - 1] + arr[i]);
    }
    let convIndex = -1;
    for (let i = 1; i < sums.length; i++) {
        let diff = Math.abs(Math.abs(sums[i] - sums[i - 1]) - target);
        if (diff < threshold) {
            if (convIndex == -1) {
                convIndex = i;
            }
        }
        else if (convIndex != -1) {
            convIndex = -1;
        }
    }
    return convIndex;
}
exports.converges_to_after = converges_to_after;
function rankNormaization(chains) {
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
    const normalizedChains = Array.from({ length: nChains }, (_, i) => normalizedRanks.slice(i * nSamples, (i + 1) * nSamples));
    return normalizedChains;
}
exports.rankNormaization = rankNormaization;
function rankNormalizedRHat(chains) {
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
exports.rankNormalizedRHat = rankNormalizedRHat;
function multiChainACF(chains, maxLag = null, exact = false) {
    //if(exact) {
    //	let acfs = chains.map(c => acfFFT(c));
    //	let avg = acfs.map(acf => acf.reduce((a, b) => a + b, 0) / acf.length);
    //	return maxLag && maxLag < avg.length ? avg.slice(0, maxLag) : avg;
    //}
    const nChains = chains.length;
    const nSamples = Math.min(...chains.map(x => x.length));
    const means = chains.map(chain => chain.reduce((sum, x) => sum + x, 0) / chain.length);
    const denominator = chains.map((chain, i) => chain.reduce((sum, x) => sum + (x - means[i]) ** 2, 0));
    function autocorrelation(chain, lag, mean, denominator) {
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
        }
        ;
        if (breakCondition && lag >= 20)
            break;
        avgAutocorrelations.push(avgAutocorr);
    }
    return [1, ...avgAutocorrelations];
}
exports.multiChainACF = multiChainACF;
function nextPowerOfTwo(n) {
    return Math.pow(2, Math.ceil(Math.log2(n)));
}
function computeMean(array) {
    return array.reduce((sum, val) => sum + val, 0) / array.length;
}
function getMedian(arr) {
    const sorted = arr.sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}
exports.getMedian = getMedian;
function multiChainESS(avgAutocorrelations, nChains, nSamples) {
    const sumRho = avgAutocorrelations.reduce((sum, rho) => sum + rho, 0);
    const ESS = (nChains * nSamples) / (1 + 2 * sumRho);
    return ESS;
}
exports.multiChainESS = multiChainESS;
function slidingRHat(chain, windowSize) {
    function internalRhat(chains, varCoeffs, sums) {
        const meansAndVars = chains.map((chain, i) => {
            const mean = sums[i] / chain.length;
            const variance = (varCoeffs[i][0] - varCoeffs[i][1] * mean + chain.length * mean ** 2) / (chain.length - 1);
            return [mean, variance];
        });
        const [meanOfSplitMeans, W] = meansAndVars.reduce(([meanSum, varSum], [mean, variance]) => [meanSum + mean, varSum + variance], [0, 0]).map(x => x / chains.length);
        const B = nSplitSamples *
            meansAndVars.reduce((sum, [m]) => sum + (m - meanOfSplitMeans) ** 2, 0) /
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
    let varianceCoeffs = splitChains.map(window => window.reduce(([a, b], x) => [a + x ** 2, b + 2 * x], [0, 0]));
    let sums = splitChains.map(window => window.reduce((a, b) => a + b, 0));
    const rHats = [internalRhat(splitChains, varianceCoeffs, sums)];
    for (let start = 1; start + windowSize < nSamples; start++) {
        const out = splitChains.map(window => window[0]);
        splitChains[0] = typedArray.subarray(start, start + halfSamples);
        splitChains[1] = typedArray.subarray(start + halfSamples, start + windowSize);
        sums = sums.map((oldSum, i) => oldSum - out[i] + splitChains[i][splitChains[i].length - 1]);
        varianceCoeffs = varianceCoeffs.map((oldVar, i) => [oldVar[0] - out[i] ** 2 + splitChains[i][splitChains[i].length - 1] ** 2, oldVar[1] - 2 * out[i] + 2 * splitChains[i][splitChains[i].length - 1]]);
        rHats.push(internalRhat(splitChains, varianceCoeffs, sums));
    }
    return rHats;
}
exports.slidingRHat = slidingRHat;
// Split R-hat
function splitRHat(chains) {
    const nSamples = Math.min(...chains.map(c => c.length));
    const halfSamples = Math.floor(nSamples / 2);
    const splitChains = chains.flatMap(chain => [
        chain.slice(0, halfSamples),
        chain.slice(halfSamples)
    ]);
    const nSplitChains = splitChains.length;
    const nSplitSamples = splitChains[0].length;
    function variance(data) {
        const mean = data.reduce((sum, x) => sum + x, 0) / data.length;
        return data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (data.length - 1);
    }
    const withinChainVariances = splitChains.map(chain => variance(chain));
    const W = withinChainVariances.reduce((sum, v) => sum + v, 0) / nSplitChains;
    const splitMeans = splitChains.map(chain => chain.reduce((sum, x) => sum + x, 0) / chain.length);
    const meanOfSplitMeans = splitMeans.reduce((sum, m) => sum + m, 0) / nSplitChains;
    const B = nSplitSamples *
        splitMeans.reduce((sum, m) => sum + (m - meanOfSplitMeans) ** 2, 0) /
        (nSplitChains - 1);
    const VHat = ((nSplitSamples - 1) / nSplitSamples) * W + (B / nSplitSamples);
    return Math.sqrt(VHat / W);
}
exports.splitRHat = splitRHat;
function effectiveSampleSize(autoCorr, numSamples) {
    return numSamples / (1 + 2 * takeWhile(autoCorr, (x) => x > 0).reduce((a, b) => a + b, 0));
}
exports.effectiveSampleSize = effectiveSampleSize;
function takeWhile(arr, fn) {
    let i = 0;
    while (i < arr.length && fn(arr[i])) {
        i += 1;
    }
    return arr.slice(0, i + 1);
}
exports.takeWhile = takeWhile;
function acf(trace, maxLag = null) {
    let avg = mean(trace);
    let result = [];
    maxLag = maxLag != null && maxLag < trace.length / 2 ? maxLag : trace.length / 2;
    for (let t = 1; t < maxLag; t++) {
        let n = 0;
        let d = 0;
        for (let i = 0; i < trace.length; i++) {
            let xim = trace[i] - avg;
            n += xim * (trace[(i + t) % trace.length] - avg);
            d += xim * xim;
        }
        result.push(n / d);
    }
    return result;
}
exports.acf = acf;
function mean(trace) {
    return trace.reduce((a, b) => a + b, 0) / trace.length;
}
//# sourceMappingURL=helper.js.map