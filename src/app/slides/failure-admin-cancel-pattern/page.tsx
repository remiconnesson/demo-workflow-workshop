import { PatternSlideLayout } from "../_components/pattern-slide-layout";
import { failureGroups } from "../_data/failure-groups";

const { marker, markerLabel } = failureGroups["failure-admin-cancel"];

export default function FailureAdminCancelPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="09d · Admin cancel — concept / pattern"
      patternName="Stop Workflow"
      description="Race a cancel hook against a short decision window. resumeHook() wins the race and wakes the suspended workflow automatically, so the saga unwinds compensations durably."
      apiPrimitive="createHook() + resumeHook()"
      docSection="Cookbook · Agent Patterns"
      docUrl="useworkflow.dev/docs/cookbook/agent-patterns/stop-workflow"
      marker={marker}
      markerLabel={markerLabel}
    />
  );
}
