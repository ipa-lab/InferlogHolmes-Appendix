"use strict";
/**
 *
 * Taken with small adjustments from https://github.com/flatironinstitute/stan-playground/blob/2e5ff6d3191cfea6eb5765d0c54c42e523551c02/gui/src/app/util/stan_stats/stan_stats.ts#L212
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.acfFFT = exports.inverseTransform = exports.transform = void 0;
/**
 *
 * @param n
 * @returns
 */
function nextPowerOfTwo(n) {
    return Math.pow(2, Math.ceil(Math.log2(n)));
}
function computeMean(array) {
    return array.reduce((sum, val) => sum + val, 0) / array.length;
}
function transform(real, imag) {
    const n = real.length;
    if (n != imag.length)
        throw new RangeError("Mismatched lengths");
    if (n == 0)
        return;
    else if ((n & (n - 1)) == 0) // Is power of 2
        transformRadix2(real, imag);
    else // More complicated algorithm for arbitrary sizes
        transformBluestein(real, imag);
}
exports.transform = transform;
/*
 * Computes the inverse discrete Fourier transform (IDFT) of the given complex vector, storing the result back into the vector.
 * The vector can have any length. This is a wrapper function. This transform does not perform scaling, so the inverse is not a true inverse.
 */
function inverseTransform(real, imag) {
    transform(imag, real);
}
exports.inverseTransform = inverseTransform;
/*
 * Computes the discrete Fourier transform (DFT) of the given complex vector, storing the result back into the vector.
 * The vector's length must be a power of 2. Uses the Cooley-Tukey decimation-in-time radix-2 algorithm.
 */
function transformRadix2(real, imag) {
    // Length variables
    const n = real.length;
    if (n != imag.length)
        throw new RangeError("Mismatched lengths");
    if (n == 1) // Trivial transform
        return;
    let levels = -1;
    for (let i = 0; i < 32; i++) {
        if (1 << i == n)
            levels = i; // Equal to log2(n)
    }
    if (levels == -1)
        throw new RangeError("Length is not a power of 2");
    // Trigonometric tables
    let cosTable = new Array(n / 2);
    let sinTable = new Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
        cosTable[i] = Math.cos(2 * Math.PI * i / n);
        sinTable[i] = Math.sin(2 * Math.PI * i / n);
    }
    // Bit-reversed addressing permutation
    for (let i = 0; i < n; i++) {
        const j = reverseBits(i, levels);
        if (j > i) {
            let temp = real[i];
            real[i] = real[j];
            real[j] = temp;
            temp = imag[i];
            imag[i] = imag[j];
            imag[j] = temp;
        }
    }
    // Cooley-Tukey decimation-in-time radix-2 FFT
    for (let size = 2; size <= n; size *= 2) {
        const halfsize = size / 2;
        const tablestep = n / size;
        for (let i = 0; i < n; i += size) {
            for (let j = i, k = 0; j < i + halfsize; j++, k += tablestep) {
                const l = j + halfsize;
                const tpre = real[l] * cosTable[k] + imag[l] * sinTable[k];
                const tpim = -real[l] * sinTable[k] + imag[l] * cosTable[k];
                real[l] = real[j] - tpre;
                imag[l] = imag[j] - tpim;
                real[j] += tpre;
                imag[j] += tpim;
            }
        }
    }
    // Returns the integer whose value is the reverse of the lowest 'width' bits of the integer 'val'.
    function reverseBits(val, width) {
        let result = 0;
        for (let i = 0; i < width; i++) {
            result = (result << 1) | (val & 1);
            val >>>= 1;
        }
        return result;
    }
}
/*
 * Computes the discrete Fourier transform (DFT) of the given complex vector, storing the result back into the vector.
 * The vector can have any length. This requires the convolution function, which in turn requires the radix-2 FFT function.
 * Uses Bluestein's chirp z-transform algorithm.
 */
function transformBluestein(real, imag) {
    // Find a power-of-2 convolution length m such that m >= n * 2 + 1
    const n = real.length;
    if (n != imag.length)
        throw new RangeError("Mismatched lengths");
    let m = 1;
    while (m < n * 2 + 1)
        m *= 2;
    // Trigonometric tables
    let cosTable = new Array(n);
    let sinTable = new Array(n);
    for (let i = 0; i < n; i++) {
        const j = i * i % (n * 2); // This is more accurate than j = i * i
        cosTable[i] = Math.cos(Math.PI * j / n);
        sinTable[i] = Math.sin(Math.PI * j / n);
    }
    // Temporary vectors and preprocessing
    let areal = newArrayOfZeros(m);
    let aimag = newArrayOfZeros(m);
    for (let i = 0; i < n; i++) {
        areal[i] = real[i] * cosTable[i] + imag[i] * sinTable[i];
        aimag[i] = -real[i] * sinTable[i] + imag[i] * cosTable[i];
    }
    let breal = newArrayOfZeros(m);
    let bimag = newArrayOfZeros(m);
    breal[0] = cosTable[0];
    bimag[0] = sinTable[0];
    for (let i = 1; i < n; i++) {
        breal[i] = breal[m - i] = cosTable[i];
        bimag[i] = bimag[m - i] = sinTable[i];
    }
    // Convolution
    let creal = new Array(m);
    let cimag = new Array(m);
    convolveComplex(areal, aimag, breal, bimag, creal, cimag);
    // Postprocessing
    for (let i = 0; i < n; i++) {
        real[i] = creal[i] * cosTable[i] + cimag[i] * sinTable[i];
        imag[i] = -creal[i] * sinTable[i] + cimag[i] * cosTable[i];
    }
}
/*
 * Computes the circular convolution of the given real vectors. Each vector's length must be the same.
 */
// function convolveReal(xvec: Array<number>|Float64Array, yvec: Array<number>|Float64Array, outvec: Array<number>|Float64Array): void {
// 	const n: number = xvec.length;
// 	if (n != yvec.length || n != outvec.length)
// 		throw new RangeError("Mismatched lengths");
// 	convolveComplex(xvec, newArrayOfZeros(n), yvec, newArrayOfZeros(n), outvec, newArrayOfZeros(n));
// }
/*
 * Computes the circular convolution of the given complex vectors. Each vector's length must be the same.
 */
function convolveComplex(xreal, ximag, yreal, yimag, outreal, outimag) {
    const n = xreal.length;
    if (n != ximag.length || n != yreal.length || n != yimag.length
        || n != outreal.length || n != outimag.length)
        throw new RangeError("Mismatched lengths");
    xreal = xreal.slice();
    ximag = ximag.slice();
    yreal = yreal.slice();
    yimag = yimag.slice();
    transform(xreal, ximag);
    transform(yreal, yimag);
    for (let i = 0; i < n; i++) {
        const temp = xreal[i] * yreal[i] - ximag[i] * yimag[i];
        ximag[i] = ximag[i] * yreal[i] + xreal[i] * yimag[i];
        xreal[i] = temp;
    }
    inverseTransform(xreal, ximag);
    for (let i = 0; i < n; i++) { // Scaling (because this FFT implementation omits it)
        outreal[i] = xreal[i] / n;
        outimag[i] = ximag[i] / n;
    }
}
function newArrayOfZeros(n) {
    let result = [];
    for (let i = 0; i < n; i++)
        result.push(0);
    return result;
}
function forwardFFT(signal) {
    const realPart = [...signal];
    const imagPart = new Array(signal.length).fill(0);
    inverseTransform(realPart, imagPart);
    return realPart.map((v, i) => [v, imagPart[i]]);
}
function inverseFFT(freqvec) {
    const realPart = freqvec.map((v) => v[0]);
    const imagPart = freqvec.map((v) => v[1]);
    transform(realPart, imagPart);
    return realPart.map((v, i) => [v, imagPart[i]]);
}
function fftNextGoodSize(n) {
    const isGoodSize = (n) => {
        while (n % 2 === 0) {
            n /= 2;
        }
        while (n % 3 === 0) {
            n /= 3;
        }
        while (n % 5 === 0) {
            n /= 5;
        }
        return n === 1;
    };
    while (!isGoodSize(n)) {
        n++;
    }
    return n;
}
/**
 *
 * @param y trace
 * @returns acf result
 */
function acfFFT(y) {
    const N = y.length;
    const M = nextPowerOfTwo(N);
    const Mt2 = 2 * M;
    // centered_signal = y-mean(y) followed by N zeros
    const centered_signal = new Array(Mt2).fill(0);
    const y_mean = computeMean(y);
    for (let n = 0; n < N; n++) {
        centered_signal[n] = y[n] - y_mean;
    }
    const freqvec = forwardFFT(centered_signal);
    for (let i = 0; i < freqvec.length; i++) {
        freqvec[i] = [freqvec[i][0] ** 2 + freqvec[i][1] ** 2, 0];
    }
    const ac_tmp = inverseFFT(freqvec);
    // use "biased" estimate as recommended by Geyer (1992)
    const ac = new Array(N).fill(0);
    for (let n = 0; n < N; n++) {
        ac[n] = ac_tmp[n][0] / (N * N * 2);
    }
    const ac0 = ac[0];
    for (let n = 0; n < N; n++) {
        ac[n] /= ac0;
    }
    return ac;
}
exports.acfFFT = acfFFT;
//# sourceMappingURL=fourier.js.map