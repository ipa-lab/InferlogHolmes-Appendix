"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarningType = exports.getStatistic = exports.checkAccepted = exports.enumerate = exports.WARNING_CONFIG = exports.WorkerTopic = void 0;
const helper_1 = require("./helper");
var WorkerTopic;
(function (WorkerTopic) {
    WorkerTopic[WorkerTopic["GetWarnings"] = 0] = "GetWarnings";
    WorkerTopic[WorkerTopic["finalReport"] = 1] = "finalReport";
})(WorkerTopic || (exports.WorkerTopic = WorkerTopic = {}));
exports.WARNING_CONFIG = {
    "hmc": {
        AcceptanceRateThreshold: 0.8,
        AcceptanceRateUpperThreshold: 0.95,
        CheckFunnel: true,
        ESSTargetThreshold: 400,
        RHatSplitChainESSThreshold: 50,
        RHatThreshold: 1.01,
        EssCalcEvery: 20
    },
    "nuts": {
        AcceptanceRateThreshold: 0.6,
        AcceptanceRateUpperThreshold: 0.95,
        CheckFunnel: true,
        ESSTargetThreshold: 400,
        RHatSplitChainESSThreshold: 50,
        RHatThreshold: 1.01,
        EssCalcEvery: 20
    },
    "metropolis_hastings": {
        AcceptanceRateThreshold: 0.2,
        AcceptanceRateUpperThreshold: 0.65,
        CheckFunnel: true,
        ESSTargetThreshold: 400,
        RHatSplitChainESSThreshold: 50,
        RHatThreshold: 1.01,
        EssCalcEvery: 20
    }
};
function* enumerate(n) {
    for (let i = 0; i < n; i++) {
        yield i;
    }
}
exports.enumerate = enumerate;
function checkAccepted(t, idx) {
    return t.accepted instanceof Array ? t.accepted[idx] : t.accepted;
}
exports.checkAccepted = checkAccepted;
function getStatistic(chains, variable, algs, burninCount, totalCount, burninTest, finalReport) {
    algs = algs instanceof Array ? algs : [algs];
    let alg = algs instanceof Array ? algs.findIndex(a => a.params.varNames && a.params.varNames.includes(variable.replace(/_\d+/, ""))) : algs;
    alg = alg == -1 ? 0 : alg;
    const config = exports.WARNING_CONFIG[algs[alg].method];
    const nChains = chains.length;
    const nSamples = chains.reduce((p, c) => p + c.length, 0);
    const finalChainLength = (totalCount - burninCount) * nChains;
    const includeBurnin = finalReport || !burninCount ? false : (nSamples - nChains * burninCount) < (finalChainLength / 2);
    const adjustedChains = includeBurnin ? chains : chains.map(c => c.slice(burninCount));
    let acceptanceRate = (adjustedChains.map(c => c.filter(t => checkAccepted(t, alg)).length / (c.length || 1)).reduce((a, b) => a + b, 0) / adjustedChains.length);
    acceptanceRate = Number.isFinite(acceptanceRate) ? acceptanceRate : 0;
    let isStuckChain = adjustedChains.findIndex(c => c.length > 10 && !c.slice(-10).filter(x => checkAccepted(x, alg)).length);
    isStuckChain = isStuckChain === -1 ? undefined : isStuckChain;
    const vals = adjustedChains.map(c => (0, helper_1.getTraceValues)(c, variable, false));
    const acf = (0, helper_1.multiChainACF)(vals, finalReport ? null : 100, finalReport);
    let ess = (0, helper_1.multiChainESS)((0, helper_1.takeWhile)(acf, x => x >= 0), vals.length, Math.min(...vals.map(x => x.length)));
    ess = Number.isFinite(ess) ? ess : 0;
    const rHat = ess > config.RHatSplitChainESSThreshold * nChains || finalReport ? (0, helper_1.rankNormalizedRHat)(vals) : undefined;
    //const burninTestResults = burninTest || finalReport ? testChainBurninFree(vals, config) : undefined;
    const burninRhatWindow = burninTest || finalReport ? slidingWindowSingleChainRHat(vals, config) : undefined;
    return {
        acceptanceRate,
        isStuckChain,
        ess,
        acf,
        includesBurnin: includeBurnin,
        rHat,
        rhatWindowStats: burninRhatWindow,
        drawnAt: Math.floor(chains.reduce((acc, c) => acc + c.length, 0) / nChains)
    };
}
exports.getStatistic = getStatistic;
function slidingWindowSingleChainRHat(chains, config) {
    let i = 0;
    const rhatStats = [];
    for (let chain of chains) {
        const chainLength = chain.length;
        const windowSize = Math.floor(chainLength * 2 / 3);
        let window = chain.slice(0, windowSize);
        const acfLeft = (0, helper_1.multiChainACF)([window.slice(0, Math.floor(window.length / 2)), window.slice(Math.floor(window.length / 2))], 100, false);
        let essLeft = (0, helper_1.multiChainESS)((0, helper_1.takeWhile)(acfLeft, x => x >= 0), 2, Math.floor(window.length / 2));
        essLeft = Number.isFinite(essLeft) ? essLeft : 0;
        const rhatOW = (0, helper_1.slidingRHat)(chain, windowSize).map((rhat, i) => ({ rhat, draw: i }));
        const acfRight = (0, helper_1.multiChainACF)([window.slice(0, Math.floor(window.length / 2)), window.slice(Math.floor(window.length / 2))], 100, false);
        let essRight = (0, helper_1.multiChainESS)((0, helper_1.takeWhile)(acfRight, x => x >= 0), 2, Math.floor(window.length / 2));
        essRight = Number.isFinite(essRight) ? essRight : 0;
        rhatStats.push({
            chain: i,
            rhatLeft: rhatOW[0].rhat,
            rhatRight: rhatOW[rhatOW.length - 1].rhat,
            essLeft,
            essRight,
            rhatOW
        });
        i++;
    }
    return rhatStats;
}
function testChainBurninFree(chains, config) {
    const result = [];
    let i = 0;
    for (let chain of chains) {
        const chainLength = chain.length;
        let batches = [...Array(3).keys()].map(i => chain.slice(i * Math.floor(chainLength / 3), (i + 1) * Math.floor(chainLength / 3)));
        const acf = (0, helper_1.multiChainACF)(batches, 100, false);
        let ess = (0, helper_1.multiChainESS)((0, helper_1.takeWhile)(acf, x => x >= 0), batches.length, Math.min(...batches.map(x => x.length)));
        ess = Number.isFinite(ess) ? ess : 0;
        const rhatLeft = (0, helper_1.rankNormalizedRHat)(batches.slice(0, 2));
        const rhatRight = (0, helper_1.rankNormalizedRHat)(batches.slice(1, 3));
        if (ess > config.RHatSplitChainESSThreshold && rhatLeft > config.RHatThreshold && rhatLeft - rhatRight > 0.001) {
            result.push({
                chain: i,
                rHatLeft: rhatLeft,
                rHatRight: rhatRight,
                ess: ess
            });
            i++;
        }
    }
    return result.length ? result : undefined;
}
var WarningType;
(function (WarningType) {
    WarningType[WarningType["AcceptanceRateWarning"] = 0] = "AcceptanceRateWarning";
    WarningType[WarningType["FunnelWarning"] = 1] = "FunnelWarning";
    WarningType[WarningType["BadParamScaleWarning"] = 2] = "BadParamScaleWarning";
    WarningType[WarningType["SampleSizeWarning"] = 3] = "SampleSizeWarning";
    WarningType[WarningType["RHatWarning"] = 4] = "RHatWarning";
    WarningType[WarningType["TraceStuckWarning"] = 5] = "TraceStuckWarning";
    WarningType[WarningType["BurninWarning"] = 6] = "BurninWarning";
    WarningType[WarningType["AutoCorrWarning"] = 7] = "AutoCorrWarning";
    WarningType[WarningType["UnspecificWarning"] = 8] = "UnspecificWarning";
})(WarningType || (exports.WarningType = WarningType = {}));
//# sourceMappingURL=warnings.js.map