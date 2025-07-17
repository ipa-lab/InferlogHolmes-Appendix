import {
    Chart, 
    BarController, 
    BarElement, 
    CategoryScale, 
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Legend,
    Title,
    type ChartConfiguration,
    type ChartData
} from "chart.js";
import annotationPlugin from 'chartjs-plugin-annotation';
import type { ChartType } from "./ChartWorkerWrapper";
import { rankNormaization } from "../utilities/helper";

Chart.register(annotationPlugin);
Chart.register(
    LineController,
    LineElement,
    LinearScale,
    CategoryScale,
    PointElement,
    BarController,
    BarElement,
    Legend,
    Title
);

let chart: null | Chart = null;
let cv: any | null = null;
let config: ChartConfiguration | null = null;

const RESOLUTION_FACTOR = 2;

onmessage = function(event: any) { 

    switch (event.data.type) {
        case "init":
            init(event);
            break;
        case "update":
            update(event);
            break;
        case "resize":
            resize(event);
            break;
    }
};

function resize(event: any) {
    const {width, height} = event.data;
    if(chart) chart.canvas.width = RESOLUTION_FACTOR * width;
    if(chart) chart.canvas.height = RESOLUTION_FACTOR * height;
    chart?.canvas.getContext('2d')?.scale(RESOLUTION_FACTOR, RESOLUTION_FACTOR);
    chart?.resize();
}

function init(event: any) {
    const {canvas, chartType, data} = event.data as {canvas: OffscreenCanvas, chartType: ChartType, data: any};
    canvas.width = RESOLUTION_FACTOR * canvas.width;
    canvas.height = RESOLUTION_FACTOR * canvas.height;
    canvas.getContext('2d')?.scale(RESOLUTION_FACTOR, RESOLUTION_FACTOR);

    let config: ChartConfiguration;

    switch(chartType) {
        case "trace":
            config = initTraceConfig(data);
            break;
        case "histogram":
            config = initHistogramConfig(false, data);
            break;
        case "rank-grid":
            config = initHistogramConfig(true, data);
            break;
        //case "acf":
        //    config = initAcfConfig(data);
        //    break;
        //case "pairplot":
        //    config = initPairplotConfig(data);
        //    break;
    }
    cv = canvas;
    //@ts-ignore
    chart = new Chart(canvas, config);
    
}

function update(event: any) {
    const {chartType, data} = event.data as {chartType: ChartType, data: any};
    if(data == null) {
        console.log("CHART NULL", event.data.data);
        return;
    }
    if(chart == null) {
        console.log("CHART NULL", event.data.data);
        return;
    }

    let newData;

    switch(chartType) {
        case "trace":
            newData = prepareTraceData(data);
            break;
        case "histogram":
            newData = prepareHistogramData(false, data);
            break;
        case "rank-grid":
            newData = prepareHistogramData(true, data);
            break;
    }

    //@ts-ignore
    chart.data = newData;
    //@ts-ignore
    chart.update();
}

function preprocessTraceData(data: number[]): {x: number, y: number}[] {
    return data.map((v, i) => {
        return {
            x: i,
            y: v,
        };
    })
}


function initHistogramConfig(rankplot: boolean, {variable, chain, inGrid, chains}: {variable: string, chain: number, inGrid: boolean, chains: Float64Array[]}): ChartConfiguration {
    const data = prepareHistogramData(rankplot, {variable, chain, inGrid, chains});

    const scales = inGrid && rankplot ? {
        x: {
            min: 0,
            max: 20,
            ticks: {
                font: {
                    size: 10 * RESOLUTION_FACTOR, // Scale tick labels
                },
            },
        },
        y: {
            ticks: {
                font: {
                    size: 10 * RESOLUTION_FACTOR,
                },
            },
        }
    } : {
        x: {
            ticks: {
                font: {
                    size: 10 * RESOLUTION_FACTOR, // Scale tick labels
                },
            },
        },
        y: {
            ticks: {
                font: {
                    size: 10 * RESOLUTION_FACTOR,
                },
            },
        }
    };

    const config: ChartConfiguration = {
        type: "bar",
        data: data,
        options: {
            plugins: {
                legend: {
                    labels: {
                        font: {
                            size: 12 * RESOLUTION_FACTOR, // Scale font size
                        },
                    },
                },
            },
            //@ts-ignore
            skipNull: false,
            animation: false,
            scales: scales
        },
    };

    return config;
}

function prepareHistogramData(rankplot: boolean, {variable, chain, inGrid, chains}: {variable: string, chain: number, inGrid: boolean, chains: Float64Array[]}): ChartData {
    const trace = chains.map(c => Array.from(c));
    const values = rankplot ? rankNormaization(trace)[chain] : trace[chain].toSorted(
        (a, b) => a - b,
    );

    const numberOfBins = rankplot ? 20 : inGrid ? 30 : getBinCount(values);

    const [minGlobal, maxGloabl] = findMinMax(trace);

    const bw = rankplot ? 1.0 / numberOfBins : inGrid ? (maxGloabl - minGlobal) / numberOfBins : (values[values.length - 1] - values[0]) / numberOfBins;

    const bins = new Array(numberOfBins).fill(0);

    let currentBin = 1;

    if(rankplot) {
        for (let value of values) {
            bins[Math.floor(value * numberOfBins)]++;
        }
    } else if(inGrid) {
        for (let value of values) {
            while(value > currentBin * bw + minGlobal) {
                currentBin++;
            }
            bins[currentBin - 1]++;
        }
    } else {
        for (let value of values) {
            while(value > currentBin * bw + values[0]) {
                currentBin++;
            }
            bins[currentBin - 1]++;
        }
    }
    

    const labels = rankplot ? bins.map((_, i) => (i * bw).toFixed(2)) : bins.map((_, i) => (i * bw + (inGrid ? minGlobal : values[0])).toFixed(2));

    const bgColor = rankplot ? "rgb(75, 192, 192, 1)" : "rgb(255, 99, 132, 0.2)";
    const borderColor = rankplot ? "rgb(75, 192, 192, 1)" : "rgb(255, 99, 132, 1)";

    const datasets = [
        {
            label: `${variable} ${rankplot ? 'Rank Plot' : 'Histogram'} Chain ${chain}`,
            data: bins,
            backgroundColor: bgColor,
            borderColor: borderColor,
            borderWidth: 1,
        },
    ];

    const data = {
        labels,
        datasets,
    };

    return data;
}

function initTraceConfig({variable, chain, trace, burnin}: {variable: string, chain: number, trace: Float64Array, burnin: number}): ChartConfiguration {

    const data = prepareTraceData({variable, chain, trace});

    let annotations = burnin && burnin > 0 ? [
        {
            type: "line",
            xMin:
                burnin ?? 0,
            xMax:
                burnin ?? 0,
            value: 5,
            borderColor: "rgb(255, 62, 62)",
            borderWidth: 1,
            label: {
                content: "Burnin",
                display: true,
                position: "end",
                font: {size: 10 * RESOLUTION_FACTOR},
                opacity: 0.6,
                xAdjust: -20,
                yAdjust: -10,
                backgroundColor: "rgb(0,0,0,0)",
                color: "rgb(255, 62, 62)",
            },
        },
        {
            type: "box",
            xMin: 0,
            xMax:
                burnin ?? 0,
            borderColor: "rgb(255, 62, 62, 0.1)",
            borderWidth: 0,
            backgroundColor: "rgba(255, 62, 62, 0.1)",
        },
    ] : undefined;

    let config: ChartConfiguration = {
        type: "line",
        data: data,
        options: {
            parsing: false,
            normalized: true,
            animation: false,
            responsive: false,
            plugins: {
                legend: {
                    labels: {
                        font: {
                            size: 12 * RESOLUTION_FACTOR, // Scale font size
                        },
                    },
                },
                annotation: {
                    //@ts-ignore
                    annotations: annotations
                },
            },
            scales: {
                x: {
                    ticks: {
                        font: {
                            size: 10 * RESOLUTION_FACTOR, // Scale tick labels
                        },
                    },
                },
                y: {
                    ticks: {
                        font: {
                            size: 10 * RESOLUTION_FACTOR,
                        },
                    },
                },
            },
        },
    };

    return config;
}

function prepareTraceData({variable, chain, trace}: {variable: string, chain: number, trace: Float64Array}): ChartData {
    const arr = Array.from(trace);

    return {
        labels: arr.map((_, i) => i),
        datasets: [
            {
                label: `${variable} trace Chain ${chain}`,
                data: preprocessTraceData(arr),
                fill: false,
                borderColor: "rgb(75, 192, 192)",
                tension: 0.0,
                pointStyle: false,
                borderWidth: 1,
            },
        ],
    };
}



//// Extra helper functions
function findMinMax(arr: number[][]): [number, number] {
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < arr[i].length; j++) {
            if (arr[i][j] < min) {
                min = arr[i][j];
            }
            if (arr[i][j] > max) {
                max = arr[i][j];
            }
        }
    }

    return [min, max];
}

function getBinCount(values: number[]): number {
    values.sort((a, b) => a - b);

    let unique_elements = values.filter(
        (v, i, a) => a.indexOf(v) === i,
    ).length;

    let numberOfBins =
        values.length / 3 > unique_elements
            ? unique_elements
            : values.length / 3;

    if (numberOfBins > 20) {
        numberOfBins = 20;
    } else if (numberOfBins < 3) {
        numberOfBins = unique_elements;
    }

    numberOfBins = Math.floor(numberOfBins);

    return numberOfBins;
}