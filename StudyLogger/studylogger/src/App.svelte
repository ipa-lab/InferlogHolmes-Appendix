<script lang="ts">
    import { StudyEventType, studyLogger } from "./store";
    import dayjs from 'dayjs'
    import duration  from 'dayjs/plugin/duration'
    import isBetween  from 'dayjs/plugin/isBetween'
    import Prepare from "./lib/Prepare.svelte";
    import { ID_GENERATOR } from "./helper";
    import Task from "./lib/Task.svelte";
    import Analyse from "./lib/Analyse.svelte";
    import ChainTraces from "./lib/ChainTraces.svelte";
    import CleanTraces from "./lib/CleanTraces.svelte";

    dayjs.extend(duration);
    dayjs.extend(isBetween);


  let studyStarted = false;
  let studyStartTime = dayjs();

  function startStudy({Participant, Evaluator, tasksInOrder}: {Participant: string, Evaluator: string, tasksInOrder: {name: string, includesDebugger: boolean, todos: string[]}[]}) {
    studyStarted = true;
    studyStartTime = dayjs();
    let currentTask = $studyLogger.currentTask + 1;
    
    studyLogger.withParticipant(Participant);
    studyLogger.withEvaluator(Evaluator);
    studyLogger.withTaskOrder(tasksInOrder);
    studyLogger.startStudy();
  }

  function downloadEventJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify($studyLogger));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${$studyLogger.participant.trim()}_study_result.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  let analyze = false;
  let patch = false;
  let clean = false;

</script>

<main>
  {#if analyze}
    <Analyse />
  {:else if patch}
    <ChainTraces></ChainTraces>
  {:else if clean}
    <CleanTraces></CleanTraces>
  {:else if !studyStarted || !$studyLogger.taskOrder.length}
    <button on:click={() => analyze = true}>Analyze</button>
    <button on:click={() => patch = true}>Patch</button>
    <button on:click={() => clean = true}>Clean</button>
    <Prepare on:startStudy={(e) => startStudy(e.detail)} />
  {:else}
  <div class="top">
    {#if $studyLogger.currentTask < $studyLogger.taskOrder.length}
      <Task task={$studyLogger.taskOrder[$studyLogger.currentTask]} />
    {:else}
      <div>Study ended</div>
      <button on:click={downloadEventJson}>save</button>
    {/if}
  </div>
  <div class="bottom">
    <div style="width: 100%; max-height: 20vh; margin-top: 8px; overflow-y: scroll;">
    <table class="past-events-container">
      <thead>
        <tr class="event">
          <th>Index</th>
          <th>Type</th>
          <th>Time</th>
          <th>After</th>
          <th>Info</th>
        </tr>
      </thead>
      <tbody>
        {#each $studyLogger.events.toReversed() as event, i}
          <tr class="event">
            <td>{$studyLogger.events.length - i - 1}</td>
            <td>{event.type}</td>
            <td>{event.time.format("HH:mm:ss")}</td>
            <td>{event.after.format("HH:mm:ss")}</td>
            <td>{JSON.stringify(event.info)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
    </div>
  {/if}
</main>

<style>

  .top {
    height: 80vh;
    max-height: 80vh;
    overflow-y: scroll;
  }
  .bottom {
    height: 20vh;
  }
  .past-events-container {
    max-height: 100px;
    width: 100%;
    overflow-y: scroll;
    padding-top: 8px;
    border-top: 3px solid black;
  }

  .event {
    border-bottom: 1px solid black;
    padding: 8px;
  }

  tbody > tr:nth-of-type(even) {
    background-color: hsl(0 0 60);
  }
  
</style>
