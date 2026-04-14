import { PatternSlideLayout } from "../_components/pattern-slide-layout";
import { failureGroups } from "../_data/failure-groups";

const { marker, markerLabel } = failureGroups["failure-driver-refuses"];

export default function FailureDriverRefusesPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="09d · The refusal — concept / pattern"
      patternName="Transactions & Rollbacks"
      description="Push an undo for each step. When a FatalError fires, your workflow catches it and unwinds the stack in reverse order. A durable saga pattern you implement with workflow primitives."
      apiPrimitive="FatalError  ·  compensations[]"
      docSection="Cookbook · Common Patterns"
      docUrl="useworkflow.dev/docs/cookbook/common-patterns/saga"
      marker={marker}
      markerLabel={markerLabel}
    />
  );
}
