<script lang="ts">
  import AcceptanceRate from './lib/AcceptanceRate.svelte';
    import BoardView from './lib/BoardView.svelte';
    import LiveView from './lib/LiveView.svelte';
import StaticGraph from './lib/StaticGraph.svelte';
import Static from './lib/StaticGraph.svelte'
    import TraceChart from './lib/TraceChart.svelte';
    import VariableAnalysis from './lib/VariableAnalysis.svelte';
    import WarningView from './lib/WarningView.svelte';
    import WarningViewNew from './lib/WarningViewNew.svelte';
  import {state} from './stores/store';
    import type { TraceItem } from './utilities/lasappTypes';
  import { vscode } from './utilities/vscode';
    import type { HelpfulWarningObject, Warning } from './utilities/warnings';
    import annotationPlugin from 'chartjs-plugin-annotation';
    import {Chart, Decimation} from 'chart.js/auto';

  Chart.register(annotationPlugin, Decimation);

  let traceVars: string[] = []
  let combineVars = true;

  // Handle messages sent from the extension to the webview
  window.addEventListener('message', event => {
    const message = event.data; // The json data that the extension sent
    switch (message.command) {
      case 'setState':
        state.setState(JSON.parse(message.data))
        vscode.postMessage({command: "confirmReceive", MESSAGE_ID: message.MESSAGE_ID})
        break;

      case 'setStateFunnel': 
        state.setState(JSON.parse(message.data), 1)
        vscode.postMessage({command: "confirmReceive", MESSAGE_ID: message.MESSAGE_ID})
        break;

      case 'setStateClean':
        state.setState(JSON.parse(message.data), 2)
        vscode.postMessage({command: "confirmReceive", MESSAGE_ID: message.MESSAGE_ID})
        break;

      case 'first':
        state.setModel(JSON.parse(message.data))
        vscode.postMessage({command: "confirmReceive", MESSAGE_ID: message.MESSAGE_ID})
        break;

      case 'second':
        state.setTrace(JSON.parse(message.data))
        vscode.postMessage({command: "confirmReceive", MESSAGE_ID: message.MESSAGE_ID})
        break;

      case 'addTraceItem':
        state.addTraceItem(JSON.parse(message.data))
        vscode.postMessage({command: "confirmReceive", MESSAGE_ID: message.MESSAGE_ID})
        break;

      case 'addTraceBatch':
        state.addTraceBatch(JSON.parse(message.data))
        vscode.postMessage({command: "confirmReceive", MESSAGE_ID: message.MESSAGE_ID})
        break;

      case 'start':
        state.setDebuggingSession(JSON.parse(message.data))
        vscode.postMessage({command: "confirmReceive", MESSAGE_ID: message.MESSAGE_ID})
        vscode.postMessage({command: "generateGraph" })
        break;
    }
  });

  function filterTraceVars(trace: TraceItem[][] | undefined, combine: boolean) {
    if(!trace) {
      traceVars = [];
      return;
    }

    traceVars = [...new Set(trace.flat().flatMap(t => {
      let keys = Object.keys(t.trace_current);
      return combine ? keys.map(k => k.replace(/_\d+/, "")) : keys
    }) ?? [])];
  }

  function getWarnings(warningsObject: HelpfulWarningObject[]): HelpfulWarningObject[][] {
    const grouped = Object.groupBy(warningsObject, (x) => x.baseVariable);
		console.log(grouped, Object.keys(grouped));
		return Object.keys(grouped).map((k) => grouped[k].toSorted((a, b) => b.severity - a.severity));
	}

  console.log($state.controller.debuggingSession?.trace)

  let progress = 0;
  let knownWarningsLength = 0;

  $: filterTraceVars($state.controller.debuggingSession?.trace, combineVars)

  $: progress = $state.controller.debuggingSession?.trace.reduce((acc,element) => acc + element.length, 0) ?? 0
  $: knownWarningsLength = getWarnings($state.incomingWarnings).reduce((acc, w) => acc + w.length, 0)
</script>

<div class="page">
  <div class="nav">
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="nav-item" class:selected={$state.viewState.navPage == "model"} on:click={() => state.setNavSelectet("model")}>
      Model
    </div>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="nav-item" class:selected={$state.viewState.navPage == "debugger"} on:click={() => state.setNavSelectet("debugger")}>
      Live Debugging
    </div>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="nav-item" class:selected={$state.viewState.navPage == "warnings"} on:click={() => {state.setNavSelectet("warnings"); state.acceptWarningsChange()}}>
      Warnings {knownWarningsLength ? `(${knownWarningsLength})` : ""}
    </div> 
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <!-- <div class="nav-item" class:selected={$state.viewState.navPage == "board"} on:click={() => state.setNavSelectet("board")}>
      Live Board
    </div> -->
  </div>
  {#if $state.controller.debuggingSession != undefined}
  <div class="progressbar">
    {#if $state.controller.debuggingSession}
      <div class="progress-container">
        <div class="progress-bar" style="width: {(progress / ($state.controller.debuggingSession.totalIteration * $state.controller.debuggingSession.chains)) * 100}%;">
          <div class="progress-bar-text">
            {( 100 * progress / ($state.controller.debuggingSession.totalIteration * $state.controller.debuggingSession.chains)).toFixed(0)}% ({progress} / {$state.controller.debuggingSession.totalIteration * $state.controller.debuggingSession.chains})
          </div>
        </div>
      </div>
    {/if}
  </div>
  {/if}
  <main>
    {#if $state.viewState.navPage == "model"}
    <div class="graph">
      <StaticGraph></StaticGraph>
    </div>
    {:else if $state.controller.debuggingSession == undefined}
    <div>Nothing to see yet</div>
    <div>
      <button on:click={() => vscode.postMessage({command: "debugFile"})}>Start Debugging</button>
    </div>
    {:else if !$state.controller.debuggingSession.trace.reduce((ac, a) => ac + a.length, 0)}
    <div>Waiting for first results...</div>
    {:else if $state.viewState.navPage == "board"}
    <BoardView></BoardView>
    {:else if $state.viewState.navPage == "warnings"}
    <WarningViewNew></WarningViewNew>
    {:else}
    <LiveView></LiveView>
    {/if}
  </main>
</div>


<style>

  .progress-container {
    width: 100%;
    background-color: #ef0d0d;
    border-radius: 8px;
    overflow: hidden;
  }

  .progress-bar {
    height: 24px;
    background-color: #237871;
    text-align: center;
    line-height: 24px;
    color: white;
    white-space: nowrap;
    overflow: visible;
  }

  .progress-bar-text {
    padding: 0 16px;
  }
  .page {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .nav {
    display: flex;
    /*background-color: hsl(0, 0%, 24%);*/
    justify-content: center;
    font-size: 1.6em;
  }

  .nav-item {
    padding: 4px 8px;
    /*background-color: hsl(0, 0%, 24%);*/
    background-color: var(--vscode-tab-inactiveBackground);
    cursor: pointer;
  }

  .nav-item:first-child {
    border-radius: 4px 0 0 4px;
  }

  .nav-item:last-child {
    border-radius: 0 4px 4px 0;
  }

  .nav-item.selected {
    background-color: rgb(20,20,202);
    color: hsl(0, 0%, 100%)
  }

  .graph {
    display: flex;
    width: 100%;
    overflow-y: scroll;
    overflow-x: scroll;
    justify-content: center;
  }

  @media (prefers-color-scheme: light) {
    .nav-item {
      /*background-color: hsl(0, 0%, 90%);*/
      background-color: var(--vscode-tab-inactiveBackground);
    }
  }
  
</style>
