<script lang="ts">
import { state, type BoardViewItem } from "../stores/store";
    import Histogram from "./Histogram.svelte";
    import TraceChart from "./TraceChart.svelte";
import VariableAnalysis from "./VariableAnalysis.svelte";

let graphs: BoardViewItem[] = [];
let selectedChain = 0;


  $: graphs = $state.viewState.board
</script>

<div class="container">
	<div class="view">
		<div class="graphs">
			{#each graphs as graph}
				{#if graph.graph == 'histogram'}
				<Histogram variable={graph.variable} combineVars={graph.combine} selectedChain={selectedChain}></Histogram>
				{:else if graph.graph == 'trace'}
				<TraceChart variable={graph.variable} combineVars={graph.combine} selectedChain={selectedChain}></TraceChart>
				{:else}
				Unknown Graph
				{/if}
			{/each}
		</div>
	</div>
</div>

<style>
.graphs {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px;
}
</style>