import { PatternSlideLayout } from "../_components/pattern-slide-layout";

export default function FailureAdminCancelPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="10d · The pattern"
      patternName="Stop Workflow"
      description="Any workflow that's sleeping or waiting on a hook can be woken up from the outside. Your workflow code sees the interruption and decides what to do next."
      apiPrimitive="Run.wakeUp()"
      docSection="Cookbook · Agent Patterns"
      docUrl="useworkflow.dev/docs/cookbook/agent-patterns/stop-workflow"
      marker={["notifyRestaurant", "assignDriver"]}
      markerLabel="interrupt from outside"
    />
  );
}
