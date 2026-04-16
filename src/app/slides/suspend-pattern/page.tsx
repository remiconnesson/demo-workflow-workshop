import { PatternSlideLayout } from "../_components/pattern-slide-layout";
import { scenarioGroups } from "../_data/scenario-groups";

const { marker, markerLabel } = scenarioGroups["suspend"];

export default function SuspendPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="06d · The slow restaurant — concept / pattern"
      patternName="Human-in-the-Loop"
      description="Suspend a workflow and resume it later with external data. A hook generates a unique token for any external system to send data back in."
      apiPrimitive="createHook()"
      docSection="Cookbook · Agent Patterns"
      docUrl="workflow-sdk.dev/docs/cookbook/agent-patterns/human-in-the-loop"
      marker={marker}
      markerLabel={markerLabel}
    />
  );
}
