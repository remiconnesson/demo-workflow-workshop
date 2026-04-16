import { PatternSlideLayout } from "../_components/pattern-slide-layout";
import { scenarioGroups } from "../_data/scenario-groups";

const { marker, markerLabel } = scenarioGroups["dispute"];

export default function DisputePatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="12d · The dispute — concept / pattern"
      patternName="Transactions & Rollbacks"
      description="Every step pushes an undo as it succeeds. A post-delivery dispute hook throws an error, and the workflow's catch unwinds compensations in reverse — even after the happy path finished."
      apiPrimitive="try/catch  ·  compensations[]  ·  reverse unwind"
      docSection="Cookbook · Common Patterns"
      docUrl="useworkflow.dev/docs/cookbook/common-patterns/saga"
      marker={marker}
      markerLabel={markerLabel}
    />
  );
}
