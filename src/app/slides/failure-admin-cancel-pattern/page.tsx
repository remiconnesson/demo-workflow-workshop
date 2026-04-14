import { PatternSlideLayout } from "../_components/pattern-slide-layout";

export default function FailureAdminCancelPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="10d · Admin cancel — concept / pattern"
      patternName="Stop Workflow"
      description="Use a hook as the stop signal, and optionally call Run.wakeUp() to interrupt a pending sleep so the workflow can observe that signal immediately."
      apiPrimitive="createHook() + resumeHook() + Run.wakeUp()"
      docSection="Cookbook · Agent Patterns"
      docUrl="useworkflow.dev/docs/cookbook/agent-patterns/stop-workflow"
      marker={["notifyRestaurant", "assignDriver"]}
      markerLabel="interrupt from outside"
    />
  );
}
