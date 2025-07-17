<script lang="ts">
    import { vscode } from "../utilities/vscode";
    import { HelpfulWarningBlockType, type HelpfulWarningObject } from "../utilities/warnings";
    import AutoCorrelationPlot from "./AutoCorrelationPlot.svelte";
    import BurninRhatChart from "./BurninRhatChart.svelte";
    import Histogram from "./Histogram.svelte";
    import PairPlot from "./PairPlot.svelte";
    import TraceChart from "./TraceChart.svelte";
    import WarningBlockContainer from "./WarningBlockContainer.svelte";

	export let warn: HelpfulWarningObject[];
	export let warnings: HelpfulWarningObject[][];
	export let chains: number[];

	let open = false;
</script>

<div>

	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="header" on:click={() => open = !open}>
		<div class="collapse" class:open={open}>
			<span>▶</span>
		</div>
		<div class="title">
			<h2>{warn[0].baseVariable}: </h2><div>{warn.length} {warn.length > 1 ? "Warnings" : "Warning"}</div>
		</div>
	</div>
	{#if open}
		{#each warn as warning}
			{#if warnings.length > 1}
				<h3>{warning.variable}</h3>
			{/if}
			<div class="warning">
				{#each warning.mainBlock as main}
					{#if main.type == HelpfulWarningBlockType.Text}
						{main.value}
					{:else if main.type == HelpfulWarningBlockType.TextBold}
						<div class="bold">{main.value}</div>
					{:else if main.type == HelpfulWarningBlockType.Space}
						<div style="height: 8px;"></div>
					{:else if main.type == HelpfulWarningBlockType.Plot}
						{#if main.value.chart == "trace"}
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
						{:else if main.value.chart == "acf"}
							<AutoCorrelationPlot autocorr={main.value.corr}
							></AutoCorrelationPlot>
						{:else if main.value.chart == "pairplot"}
							<PairPlot
								variable1={main.value.variable1}
								variable2={main.value.variable2}
								selectedChain={main.value.chain ?? 0}
							></PairPlot>
						{:else if main.value.chart == "rank-grid"}
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
						{:else if main.value.chart == "burnin-rhat"}
							<BurninRhatChart
								variable={main.value.variable}
								rhats={main.value.data}
								rhatThreshold={main.value.target}
								selectedChain={main.value.chain}
							></BurninRhatChart>
						{:else}
							{JSON.stringify(main)}
						{/if}
					{:else if main.type == HelpfulWarningBlockType.Html}
						{@html main.value}
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
										main.value.warning.child.node.line_no -
											1,
										main.value.warning.child.node
											.col_offset,
										main.value.warning.child.node
											.end_line_no - 1,
										main.value.warning.child.node
											.end_col_offset,
									],
								})}
						>
							Show me where
						</button>
					{:else}
						{JSON.stringify(main)}
					{/if}
				{/each}

				{#each warning.blocks as cause}
					<WarningBlockContainer {cause} {chains}
					></WarningBlockContainer>
				{/each}
			</div>
		{/each}
	{/if}
</div>


<style>
	div.title {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	div.warning {
		padding: 8px 16px;
		border-bottom: 1px solid black;
	}

	div.header {
		display: grid;
    	grid-template-columns: 32px 1fr;
		cursor: pointer;
	}
	div.title {
		font-weight: bold;
	}

	div.collapse {
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