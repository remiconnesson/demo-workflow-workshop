import { PatternSlideLayout } from "../_components/pattern-slide-layout";

export default function FailureFanOutPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="12d · The pattern"
      patternName="Fan-Out & Parallel Delivery"
      description="Promise.all and Promise.allSettled work across step calls. Put each branch in its own step if you want per-branch durability, retries, and replay."
      apiPrimitive="Promise.allSettled([ ...steps ])"
      docSection="Cookbook · Common Patterns"
      docUrl="useworkflow.dev/docs/cookbook/common-patterns/fan-out"
      marker="sendReceipt"
      markerLabel="parallel, still durable"
    />
  );
}
