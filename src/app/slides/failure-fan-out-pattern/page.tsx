import { PatternSlideLayout } from "../_components/pattern-slide-layout";

export default function FailureFanOutPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="12d · The pattern"
      patternName="Fan-Out & Parallel Delivery"
      description="Promise.all and Promise.allSettled just work. Each branch is a durable step that checkpoints, retries, and replays independently."
      apiPrimitive="Promise.allSettled([ ...steps ])"
      docSection="Cookbook · Common Patterns"
      docUrl="useworkflow.dev/docs/cookbook/common-patterns/fan-out"
      marker="sendReceipt"
      markerLabel="parallel, still durable"
    />
  );
}
