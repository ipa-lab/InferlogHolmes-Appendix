<script lang="ts">
import { state } from "../stores/store";
import type { TraceItem } from "../utilities/lasappTypes";
    import { enumerate } from "../utilities/warnings";
    import VariableAnalysis from "./VariableAnalysis.svelte";
    import VariableDetailsView from "./VariableDetailsView.svelte";

let traceVars: string[] = []
let allTraceVars: string[] = []
let selectedVariable: string | null = null;
let combineVars: boolean = $state.viewState.liveView?.combine || false;

let selectedChain = 0;

let selectionVarList: string[] = [];
let possibleSelection: string[] = [];

function filterTraceVars(trace: TraceItem[][] | undefined) {
    if(!trace) {
      traceVars = [];
      return;
    }

    allTraceVars = [...new Set(trace.flat().flatMap(t => Object.keys(t.trace_current)) ?? [])];
	traceVars = [...new Set(allTraceVars.map(k => k.replace(/_\d+/, "")))]

	if(!$state.viewState.liveView?.variable && traceVars.length > 0) {
		state.setLiveViewState({ variable: traceVars[0], combine: combineVars, showDetails: null});
	}
  }

  function getSelectedVariablesList(selected: string, combine: boolean): string[] {
	let regex = new RegExp(`${selected}(_\\d+)?`);
	possibleSelection = allTraceVars.filter(v => regex.test(v))

	if(combine) {
		return [selected]
	}

	
	return possibleSelection
  }

  $: filterTraceVars($state.controller.debuggingSession?.trace)
  $: if($state.viewState.liveView != null && $state.viewState.liveView.variable) selectionVarList = getSelectedVariablesList($state.viewState.liveView.variable, combineVars)
  $: combineVars, $state.viewState.liveView && state.setLiveViewState({ variable: $state.viewState.liveView.variable, combine: combineVars, showDetails: $state.viewState.liveView.showDetails})
</script>

<div class="container">
	{#if ($state.controller?.debuggingSession?.chains ?? 1) > 1}
	<div>
		Inspecting chain 
		<select bind:value={selectedChain}>
			{#each enumerate($state.controller.debuggingSession.chains) as chain}
			<option value={chain}>{chain}</option>
			{/each}
		</select>
	</div>
	{/if}
	{#if $state.viewState.liveView?.showDetails != null}
	<div class="view">
		<div class="nav">
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div class="nav-item" on:click={() => state.setLiveViewState({ variable: $state.viewState.liveView.variable, combine: $state.viewState.liveView.combine, showDetails: null})}>
				Back
			</div>
		</div>
		<div class="graph">
			<VariableDetailsView variable={$state.viewState.liveView.showDetails} selectedChain={selectedChain} combineVars={combineVars}></VariableDetailsView>	
		</div>
	</div>
	{:else}
	<div class="nav">
		{#each traceVars as vari}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="nav-item" class:selected={$state.viewState.liveView?.variable == vari} on:click={() => state.setLiveViewState({ variable: vari, combine: combineVars, showDetails: null})}>
			{vari}
			<!-- {#if $state.warnings.includes(vari)}
			<div class="warning">!</div>
			{/if} -->
		</div>
		{/each}
	</div>
	<div class="view">
		{#if $state.viewState.liveView?.variable != null}
		{#if possibleSelection.length > 1}
	<!--	<div class="container-header">
			<label for="combine">Combine Variables</label>
      		<input name="combine" type="checkbox" bind:checked={combineVars}>
		</div>-->
		<div class="spacer"></div>
		{:else}
		<div class="spacer"></div>
		{/if}
		<div class="graphs">
			{#each selectionVarList as variable}
				<div><button on:click={() => state.setLiveViewState({ variable: $state.viewState.liveView.variable, combine: $state.viewState.liveView.combine, showDetails: variable})}>Details</button></div>
				<VariableAnalysis variable={variable} selectedChain={selectedChain} combineVars={combineVars}></VariableAnalysis>	
			{/each}
		</div>
		{/if}
	</div>
	{/if}
</div>

<style>
.nav {
    display: flex;
    /*background-color: hsl(0, 0%, 24%);*/
    justify-content: center;
	flex-wrap: wrap;
	gap: 8px;
    font-size: 1.2em;
  }

  .nav-item {
    padding: 4px 8px;
    /*background-color: hsl(0, 0%, 24%);*/
	background-color: var(--vscode-tab-inactiveBackground);
    cursor: pointer;
  }

  .nav-item.selected {
    background-color: rgb(20,20,202);
    color: hsl(0, 0%, 100%)
  }

  .spacer {
	height: 1em;
  }

  .warning {
		background-color: hsl(51, 99%, 63%);
		color: black;
		border-radius: 50%;
		padding: 2px 8px;
		margin-left: 4px;
		max-width: 1em;
	}

  @media (prefers-color-scheme: light) {
    .nav-item {
     /*background-color: hsl(0, 0%, 90%);*/
	 background-color: var(--vscode-tab-inactiveBackground);
    }
  }
</style>