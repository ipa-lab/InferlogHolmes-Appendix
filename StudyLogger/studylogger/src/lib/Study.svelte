<script lang="ts">
	  function startStudy() {
    studyStarted = true;
    studyStartTime = dayjs();
    currentTask = 0;
    taskStartTime[currentTask] = dayjs();

    studyLogger.log({
      id: NEXT_ID.next().value,
      currentTask, 
      type: "Start", 
      time: dayjs(),
      after: dayjs.duration(0), 
      info: {}
    })
  }

  function startTask() {
    currentTask++;
    taskStartTime[currentTask] = dayjs();
    studyLogger.log({
      id: NEXT_ID.next().value,
      currentTask, 
      type: "Start", 
      time: dayjs(), 
      after: dayjs.duration(taskStartTime[currentTask].diff(studyStartTime)), 
      info: {
        task: tasksInOrder[currentTask].name
      }
    });
  }

  function endTask() {
    taskEndTime[currentTask] = dayjs();
    studyLogger.log({
      id: NEXT_ID.next().value,
      currentTask, 
      type: "End", 
      time: dayjs(), 
      after: dayjs.duration(taskEndTime[currentTask].diff(studyStartTime)), 
      info: {
        task: tasksInOrder[currentTask].name
      }
    });
  }

  function newEvent(type: string) {
    const currentTime = dayjs();
    studyLogger.log({
      id: NEXT_ID.next().value,
      currentTask, 
      type, 
      time: currentTime, 
      after: dayjs.duration(currentTime.diff(studyStartTime)), 
      info: {}
    });
  }
</script>

<div>
	{#if taskStartTime[currentTask] && !taskEndTime[currentTask]}
      <div>
        <h1>{tasksInOrder[currentTask].name}</h1>
        <button on:click={endTask}>End Task</button>
      </div>
    {:else}
    <div>
      <h1>{tasksInOrder[currentTask+1].name}</h1>
      <button on:click={startTask}>Start Task</button>
    </div>
    {/if}

    <div class="events">
      <button on:click={() => newEvent("DiscoversIssue")}>Discovers Issue</button>
      <button on:click={() => newEvent("solved")}>Task Solved</button>
      <button on:click={() => newEvent("thinksSolved")}>Thinks Task solved</button>
      <button on:click={() => newEvent("plot")}>Plots</button>
      <button on:click={() => newEvent("docs")}>Reads Documentation</button>
      <button on:click={() => newEvent("DebuggerUsed")}>Uses Debugger</button>
      <button on:click={() => newEvent("externalDocs")}>Uses External Ressource</button>
    </div>
</div>