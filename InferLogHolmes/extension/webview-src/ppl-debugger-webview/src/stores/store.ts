import { writable } from 'svelte/store';
import { vscode } from '../utilities/vscode';
//import type { Model, RandomVariable, TraceItem } from '../utilities/lasappTypes';
import type { Model, RandomVariable, TraceItem } from '../utilities/lasappTypes';
import { type ChainStats, type DebuggingState, type FunnelWarning, getHelpfulWarning, getWarnings, HelpfulWarning, type HelpfulWarningObject, type UnspecificWarning, type Warning, WARNING_CONFIG, WarningType } from '../utilities/warnings';
import { acf, converges_to_after, getTraceValues } from '../utilities/helper';


let lastCheckedWarnings = Date.now();

function createMainState() {
	const initState = () => {
		return {
			controller: {
				filePath: undefined,
				model: undefined,
				modelGraph: undefined,
				randomVariables: undefined,
				debuggingSession: undefined,
				funnel: undefined,
			},
			viewState: {
				navPage: "model",
				liveView: null,
				board: []
			},
			warnings: [],
			incomingWarnings: [],
			stats: []
		} as MainState
	}
	const { subscribe, set, update } = writable<MainState>(vscode.getState() as (MainState | undefined) || initState());

	const customUpdate = (fn: (t: MainState) => MainState) => {
		update((oldState) => {
			let newState = fn(oldState);
			vscode.setState(newState);
			return newState;
		})
	}

	const customSet = (state: MainState) => {
		vscode.setState(state);
		set(state);
	}

	const setState = (state: ControllerState, clean: 0 | 1 | 2 = 0) => {
		let ownState = vscode.getState() as MainState | undefined;
		console.log(`SET_STATE_BEFORE (clean=${clean}): `, ownState)
		console.log(`SET_STATE_INPUT (clean=${clean}): `, state)

		if(!ownState) {
			ownState = initState();
		}
		if(clean > 0) {
			ownState.controller.filePath = state.filePath;
			ownState.controller.funnel = state.funnel;
			ownState.controller.model = state.model;
			ownState.controller.modelGraph = state.modelGraph;
			ownState.controller.randomVariables = state.randomVariables;
		} else {
			ownState.controller = state;
			ownState.viewState.liveView = null;
			ownState.warnings = [];
			ownState.incomingWarnings = [];
			ownState.stats = [];
		}

		if(clean == 2) {
			console.log("CLEANING", ownState.controller)

			ownState.controller.debuggingSession = null;
		}
		console.log("SET_STATE_AFTER: ", ownState)
		customUpdate((_oldState) => {
			return ownState
		})
	}

	const setNavSelectet = (selection: 'model' | 'debugger' | 'warnings' | 'board') => {
		customUpdate((oldState) => {
			oldState.viewState.navPage = selection;
			return oldState
		})
	}

	const setViewState = (viewState: ViewState) => {
		customUpdate((oldState) => {
			oldState.viewState = viewState;
			return oldState
		})
	}

	const setLiveViewState = (viewState: LiveViewState) => {
		customUpdate((oldState) => {
			oldState.viewState.liveView = viewState;
			return oldState
		})
	}

	const addTraceBatch = ({batch, stats} : {batch: TraceItem[][], stats: {[variable: string]: ChainStats}}) => {
		customUpdate((oldState: MainState) => {
			console.log("ADD_TRACE_BATCH_BEFORE: ", oldState)
			console.log("ADD_TRACE_BATCH_BATCH: ", batch)
			console.log("ADD_TRACE_BATCH_STATS: ", stats)
			if(oldState.controller.debuggingSession) {
				for(let i = 0; i < oldState.controller.debuggingSession.trace.length && i < batch.length; i++) {
					oldState.controller.debuggingSession.trace[i].push(...batch[i]);
				}
				oldState.stats.push(stats);
				oldState.incomingWarnings = [];

				for(let variable of Object.keys(stats)) { 
					let warning = getHelpfulWarning(oldState.controller.debuggingSession, variable, stats[variable], oldState.controller.funnel);
					if(warning) {
						oldState.incomingWarnings.push(warning)
					}
				}
				
				if(oldState.warnings.length == 0) {
					oldState.warnings = oldState.incomingWarnings
				}
			}
			console.log("ADD_TRACE_BATCH_AFTER: ", oldState)
			return oldState
		})
	}

	const acceptWarningsChange = () => {
		customUpdate((oldState: MainState) => {
			oldState.warnings = oldState.incomingWarnings
			return oldState
		})
	}

	const addTraceItem = ({traceItem, chain}: {traceItem: TraceItem, chain: number}) => {
		customUpdate((oldState: MainState) => {
			if(oldState.controller.debuggingSession) {
				oldState.controller.debuggingSession.trace[chain].push(traceItem);
			}
			return oldState
		})
	}

	const setTrace = (trace: TraceItem[][]) => {
		customUpdate((oldState) => {
			if(oldState.controller.debuggingSession) {
				oldState.controller.debuggingSession.trace = trace;
			}
			return oldState
		})
	}

	const addToBoard = (boardViewItem: BoardViewItem) => {
		customUpdate((oldState) => {
			let exists = oldState.viewState.board.find(item => 
				item.variable == boardViewItem.variable && item.graph == boardViewItem.graph && item.combine == boardViewItem.combine
			);

			if(exists) {
				oldState.viewState.board = oldState.viewState.board.filter(item => 
					!(item.variable == boardViewItem.variable && item.graph == boardViewItem.graph && item.combine == boardViewItem.combine)
				);

				return oldState;
			}
			
			oldState.viewState.board = [...oldState.viewState.board, boardViewItem];
			return oldState
		})
	}

	const setDebuggingSession = (debuggingSession: DebuggingState) => {
		customUpdate((oldState) => {
			console.log("SET_DBSESSION_BEFORE: ", oldState)
			oldState.controller.debuggingSession = debuggingSession
			oldState.warnings = []
			oldState.incomingWarnings = []
			oldState.stats = []
			console.log("SET_DBSESSION_AFTER: ", oldState)
			return oldState
		})
	}

	const setModel = (model: any) => {
		customUpdate((oldState) => {
			oldState.controller.model = model;
			return oldState
		})
	}

	return {
		subscribe,
		acceptWarningsChange,
		setState,
		addToBoard,
		setNavSelectet,
		setDebuggingSession,
		setViewState,
		setLiveViewState,
		addTraceItem,
		addTraceBatch,
		setTrace,
		setModel,
		reset: () => customSet(initState())
	};
}

export type ControllerState = {
	filePath: string | undefined,
	model: Model | undefined,
	modelGraph: string | undefined,
	randomVariables: RandomVariable[] | undefined,
	debuggingSession: DebuggingState | undefined,
	funnel: any | undefined
}

export type MainState = {
	controller: ControllerState,
	viewState: ViewState,
	warnings: HelpfulWarningObject[],
	incomingWarnings: HelpfulWarningObject[],
	stats: {[variable: string]: ChainStats}[],
}

export type ViewState = {
	navPage: 'model' | 'debugger' | 'warnings' | 'board',
	liveView: LiveViewState,
	board: BoardViewItem[]
}

export type BoardViewItem = {
	variable: string,
	graph: 'histogram' | 'trace'
	combine: boolean
}

export type LiveViewState = {
	variable: string,
	combine: boolean,
	showDetails: string | null,
} | null

export const state = createMainState();
