import { PatternSlideLayout } from "../_components/pattern-slide-layout";
import { failureGroups } from "../_data/failure-groups";

const { marker, markerLabel } = failureGroups["failure-admin-cancel"];

export default function FailureAdminCancelPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="10d · Admin cancel — concept / pattern"
      patternName="Stop Workflow"
      description="This is the payoff from the last few patterns: use a hook as the stop signal, let the workflow observe it, and unwind durably. If the run is sleeping, you can wake it so the cancel lands immediately."
      apiPrimitive="createHook() + resumeHook()"
      docSection="Cookbook · Agent Patterns"
      docUrl="useworkflow.dev/docs/cookbook/agent-patterns/stop-workflow"
      marker={marker}
      markerLabel={markerLabel}
    />
  );
}
