import { PatternSlideLayout } from "../_components/pattern-slide-layout";

export default function FailureDriverRefusesPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="09d · The pattern"
      patternName="Transactions & Rollbacks"
      description="Push an undo for each step. When a FatalError fires, the runtime pops them in reverse — last in, first out. The saga pattern, built into your workflow."
      apiPrimitive="FatalError  ·  compensations[]"
      docSection="Cookbook · Common Patterns"
      docUrl="useworkflow.dev/docs/cookbook/common-patterns/saga"
      marker="assignDriver"
      markerLabel="fatal → unwind"
    />
  );
}
