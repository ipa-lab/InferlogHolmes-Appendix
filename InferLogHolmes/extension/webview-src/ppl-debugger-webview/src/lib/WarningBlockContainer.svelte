<script lang="ts">
    import { vscode } from "../utilities/vscode";
    import { HelpfulWarningBlockType, type HelpfulWarningBlock } from "../utilities/warnings";
    import AutoCorrelationPlot from "./AutoCorrelationPlot.svelte";
    import BurninRhatChart from "./BurninRhatChart.svelte";
    import Histogram from "./Histogram.svelte";
    import PairPlot from "./PairPlot.svelte";
    import TraceChart from "./TraceChart.svelte";

	export let cause: {
	    blocks: HelpfulWarningBlock[];
	    issue: string | null;
	    solution: string | null;
	    severity: number;
	};

	export let chains: number[];

	let open = cause.issue == null;

</script>



<div class="cause">

	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	{#if cause.issue != null}
	<div class="header" on:click={() => open = !open}>
		<div class="collapse" class:open={open}>
			<span>▶</span>
		</div>
		<div class="title">
			Issue: {cause.issue}
		</div>
		{#if cause.solution != null}
		<div class="solution">Suggestion: {cause.solution}</div>
		{/if}
	</div>
	{/if}
	{#if open}
	<div class="details">
	{#each cause.blocks as main}
		{#if main.type == HelpfulWarningBlockType.Text}
			<div>{main.value}</div>
		{:else if main.type == HelpfulWarningBlockType.TextBold}
			<div class="bold">{main.value}</div>
		
		{:else if main.type == HelpfulWarningBlockType.Space}
			<div style="height: 8px;"></div>
		{:else if main.type == HelpfulWarningBlockType.Plot}
			{#if main.value.chart == 'trace'}
			<div class="chart-contain">
				<TraceChart
					variable={main.value.variable}
					combineVars={false}
					selectedChain={main.value.chain}
				></TraceChart>
			</div>
			{:else if main.value.chart == "trace-grid"}
			<div class="chart-grid">
				{#each chains as chain}
				<TraceChart
					variable={main.value.variable}
					combineVars={false}
					selectedChain={chain}
				></TraceChart>
				{/each}
			</div>
			{:else if main.value.chart == 'acf'}
				<AutoCorrelationPlot
					autocorr={main.value.corr}
				></AutoCorrelationPlot>
			{:else if main.value.chart == 'pairplot'}
				<PairPlot
					variable1={main.value.variable1}
					variable2={main.value.variable2}
					selectedChain={main.value.chain ?? 0}
				></PairPlot>
			{:else if main.value.chart == 'rank-grid'}
			<div class="chart-grid">
				{#each chains as chain}
					<Histogram
						variable={main.value.variable}
						selectedChain={chain}
						combineVars={false}
						rankplot={true}
					></Histogram>
				{/each}
			</div>
			{:else if main.value.chart == 'trace-burnin-rhats'}
				<div class="chart-grid">
					<TraceChart
						variable={main.value.variable}
						combineVars={false}
						selectedChain={main.value.chain}
					></TraceChart>
					<BurninRhatChart
						variable={main.value.variable}
						rhats={main.value.rhatData}
						rhatThreshold={main.value.target}
						selectedChain={main.value.chain}
					></BurninRhatChart>
				</div>
				
			{:else}
			<div> {JSON.stringify(main)} </div>
			{/if}
		{:else if main.type == HelpfulWarningBlockType.Html}
			<div>{@html main.value}</div>
		{:else if main.type == HelpfulWarningBlockType.PPLInfo}
			<div class="ppl-info">
				<div>
					{main.value}
				</div>
			</div>
		{:else if main.type == HelpfulWarningBlockType.Code}
			<div class="code">
				{@html main.value}
			</div>
		{:else if main.type == HelpfulWarningBlockType.ShowMeWhere}
			<button
				on:click={() =>
					vscode.postMessage({
						command: "gotoline",
						data: [
							main.value.warning.child.node
								.line_no - 1,
							main.value.warning.child.node
								.col_offset,
							main.value.warning.child.node
								.end_line_no - 1,
							main.value.warning.child.node
								.end_col_offset,
						],
					})}>
				Show me where
			</button>
		{:else}
			<div>{JSON.stringify(main)}</div>
		{/if}
	{/each}
	</div>
	{/if}
</div>


<style>
	div.header {
		display: grid;
    	grid-template-columns: 32px 1fr;
    	grid-template-rows: 1fr 1fr;
		cursor: pointer;
	}
	div.title {
		font-weight: bold;
	}
	div.solution {
		font-weight: bold;
	}
	div.cause {
		padding: 8px 8px;
		background-color: rgb(255, 0, 0, 0.2);
		margin-bottom: 4px;
		border-radius: 2px;
		box-shadow: 1px 0.5px 1px 1px rbg(0, 0, 0, 0.2);
	}

	div.ppl-info {
		padding: 8px 8px 8px 46px;
    	position: relative;
    	margin: 8px 8px 4px;
    	background-color: #ff5f156d;
    	border-radius: 4px;
    	box-shadow: 1px 0.5px 1px 1px rbg(0, 0, 0, .2);
	}
	div.ppl-info::before {
		display: block;
    	position: absolute;
    	left: 10px;
    	top: 10px;
    	content: "!";
    	border-radius: 50%;
    	border: 2px solid yellow;
    	width: 20px;
    	/* font-weight: bold; */
    	height: 20px;
    	/* line-height: 22px; */
    	text-align: center;
    	color: #ff0;
    	font-weight: 700;
	}

	div.collapse {
		grid-row: 1 / 3;
    	display: flex;
    	align-items: center;
    	justify-content: start;
	}

	div.collapse > span {
		transition: all 0.2s;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	div.collapse.open > span {
		transform: rotateZ(90deg);
    	display: block;
    	width: 16px;
		transition: all 0.2s;
	}

	div.code {
		padding: 8px 8px;
		background-color: rgb(17, 17, 17, 0.6);
		color: white;
		border-radius: 2px;
	}

	.chart-contain {
		display: grid;
		grid-template-columns: 1fr;
		gap: 8px;
		padding-bottom: 8px;
		margin-bottom: 8px;
	}

	.chart-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		padding-bottom: 8px;
		border-bottom: 1px solid black;
		margin-bottom: 8px;
	}
</style>