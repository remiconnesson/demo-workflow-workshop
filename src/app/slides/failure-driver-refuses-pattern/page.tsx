import { PatternSlideLayout } from "../_components/pattern-slide-layout";
import { failureGroups } from "../_data/failure-groups";

const { marker, markerLabel } = failureGroups["failure-driver-refuses"];

export default function FailureDriverRefusesPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="12d · The dispute — concept / pattern"
      patternName="Transactions & Rollbacks"
      description="Every step pushes an undo as it succeeds. Even after the happy path completes, a post-delivery dispute hook can throw FatalError — and the workflow unwinds every compensation in reverse. A durable saga you implement with workflow primitives."
      apiPrimitive="FatalError  ·  compensations[]"
      docSection="Cookbook · Common Patterns"
      docUrl="useworkflow.dev/docs/cookbook/common-patterns/saga"
      marker={marker}
      markerLabel={markerLabel}
    />
  );
}
