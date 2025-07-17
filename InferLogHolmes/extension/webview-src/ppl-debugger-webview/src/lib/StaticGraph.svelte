<script lang="ts">
  import { controllers } from "chart.js";
import { state } from "../stores/store";
  import { vscode } from "../utilities/vscode";
  import panzoom, { type PanZoom } from "panzoom";

  let graphParent: Element;
  let instance: null | PanZoom = null;

  function updateGraphClicks() {
    let svg = graphParent.querySelector("svg");
    if(svg) {
      svg.style.height = "100%";
      svg.style.backgroundColor = "white";
    }

    let titles = graphParent.querySelectorAll("svg g.node title");
    if(instance) {
      instance.dispose();
    }
    instance = panzoom(graphParent.querySelector("svg > g") as any);
    console.log(titles)
    for(let title of titles) {
      let parent = title.parentElement;
      if(!parent) {
        continue;
      }

      parent.style.cursor = "pointer";

      parent.onclick = (evt) => {
        let found = $state.controller.randomVariables?.find(rv => rv.node.node_id.trim() == title.textContent?.trim());
        if(!found) {
          return;
        }

        vscode.postMessage({command: "gotoline", data: [found.node.line_no - 1, found.node.col_offset, found.node.end_line_no - 1, found.node.end_col_offset] })
      }

      /*
      parent.onclick = (evt) => {
        if($state.controller.debuggingSession && $state.controller.debuggingSession.trace.length) {
          let allTraceVars = [...new Set($state.controller.debuggingSession.trace[0].flatMap(t => Object.keys(t.trace_current)) ?? [])];
	        let traceVars = [...new Set(allTraceVars.map(k => k.replace(/_\d+/, "")))];

          let found1 = $state.controller.randomVariables?.find(rv => rv.node.node_id.trim() == title.textContent?.trim());
          if(!found1) {
            return;
          }

          let name = found1.name;
          let regex = /_\{?.+\}?/;

          let found = traceVars.find(v => v.trim() == name.trim().replaceAll("f'", "").replaceAll("'", "").replace(regex, ""))

          console.log(found, traceVars, name, name.trim().replaceAll("f'", "").replaceAll("'", "").replace(regex, ""))

          if(!found) {
            return;
          }
          state.setViewState({
            navPage: "debugger",
            liveView: {
              variable: found,
              combine: false,
              showDetails: null
            },
            board: $state.viewState.board
          })
        }
      } */
    }
  }

  $: $state.controller.modelGraph && graphParent ? setTimeout(updateGraphClicks, 200) : null
</script>

<div style="overflow: hidden; max-width: 100%;">
  <div>
    {#if $state.controller.modelGraph}
      <button on:click={() => vscode.postMessage({command: "generateGraph" })}>
        Reload Graph
      </button>
      <div bind:this="{graphParent}" class="graph-container" style="max-width: 100%;">{@html $state.controller.modelGraph}</div>
    {:else}
    <button on:click={() => vscode.postMessage({command: "generateGraph" })}>
      Load Graph
    </button>
    {/if}
  </div>
</div>

<style>
  .graph-container {
    height: 70vh;
    border: 1px solid;
    margin-top: 8px;
    overflow: hidden;
    border-radius: 4px;
  }

  .graph-container > svg {
    height: 100%;
  }
</style>