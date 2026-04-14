import { PatternSlideLayout } from "../_components/pattern-slide-layout";
import { failureGroups } from "../_data/failure-groups";

const { marker, markerLabel } = failureGroups["failure-slow-restaurant"];

export default function FailureSlowRestaurantPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="06d · The slow restaurant — concept / pattern"
      patternName="Human-in-the-Loop"
      description="Suspend a workflow and resume it later with external data. A hook generates a unique token for any external system to send data back in."
      apiPrimitive="createHook()"
      docSection="Cookbook · Agent Patterns"
      docUrl="useworkflow.dev/docs/cookbook/agent-patterns/human-in-the-loop"
      marker={marker}
      markerLabel={markerLabel}
    />
  );
}
