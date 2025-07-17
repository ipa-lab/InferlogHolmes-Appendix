<script lang="ts">
    import dayjs, { duration } from "dayjs";
    import Timer from "./Timer.svelte";
    import { StudyEventType, studyLogger } from "../store";
    import IssueEventCreator from "./IssueEventCreator.svelte";
    import InferenceEventCreator from "./InferenceEventCreator.svelte";
    import SimpleTimerEventCreator from "./SimpleTimerEventCreator.svelte";
    import SteppedEventCreator from "./SteppedEventCreator.svelte";
    import { ID_GENERATOR } from "../helper";
    import SteppedIssueEventCreator from "./SteppedIssueEventCreator.svelte";

  export let task: {name: string, includesDebugger: boolean, todos: string[]};

  let started = true;
  let startTime: dayjs.Dayjs | null = null;

  function startTask() {
    started = true;
    startTime = dayjs();
  }

  function logSimpleEvent(type: StudyEventType) {
		const time = dayjs();
		studyLogger.log({
			id: ID_GENERATOR.next().value, 
			currentTask: $studyLogger.currentTask, 
			type: type, 
			time: time, 
			after: dayjs.duration(time.diff($studyLogger.studyStart)), 
			info: {}
		})
	}
</script>

<div class="task">
  <div class=task-content>
    {#if !started || $studyLogger.currentTaskStart === null}
      <h2>{task.name}</h2>
      <button on:click={startTask}>Start Task</button>
    {:else}
      <Timer headline={true} startTime={$studyLogger.currentTaskStart} softMaxDuration={dayjs.duration(20, 'minutes')} maxDuration={dayjs.duration(30, 'minutes')} text={task.name}>
        <div slot="inside">
          <button on:click={() => studyLogger.nextTask()}>Next Task</button>
        </div>
      </Timer>

      {#if task.todos.length > 0}
        <div class="actions">
          <div class="main-issues">
            {#each task.todos as todo, i}
              {#key todo}
              <IssueEventCreator issue={todo} issueId={i} />
              {/key}
            {/each}
          </div>
          <div class="other-issues">
            <InferenceEventCreator />

            <SteppedIssueEventCreator issues ={task.todos} />

            <SteppedEventCreator
              evt={StudyEventType.ModelChanged}
              text="Model Changed" />

            <SteppedEventCreator
              evt={StudyEventType.InferenceChanged}
              text="Inference Changed" />

            <SteppedEventCreator 
              evt={StudyEventType.PlotUsed} 
              text="Plotted"
              options={["trace", "pair", "ppc", "rank", "model graph"]} />

            <SteppedEventCreator 
              evt={StudyEventType.DocumentationSrcUsed} 
              text="External Docs"
              options={["pymc", "python", "arviz", "stackoverflow", "google"]} />

            <SteppedEventCreator
              evt={StudyEventType.Quote}
              text="Quote" />

            <SteppedEventCreator
              evt={StudyEventType.HelpReceived}
              text="Help received" />

            <SteppedEventCreator
              evt={StudyEventType.Other}
              text="Other" />

            <SimpleTimerEventCreator 
              startingEvent={StudyEventType.SetupIssues} 
              finishingEvent={StudyEventType.SetupIssuesResolved} 
              text="setup issues" />
          </div>
        </div>
      {:else}
        <div class="bold-name">
          <h2>{task.name}</h2>
        </div>
      {/if}
    {/if}
  </div>
</div>


<style>
  .other-issues {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    padding: 1rem;
  }

  .bold-name {
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>