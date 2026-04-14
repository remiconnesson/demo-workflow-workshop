import { PatternSlideLayout } from "../_components/pattern-slide-layout";

export default function FailureCrashPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="04d · The pattern"
      patternName="Workflows and Steps"
      description="Mark a function as durable with two directives. The runtime records completed steps to an event log and can replay deterministically after a restart."
      apiPrimitive={`"use workflow"  ·  "use step"`}
      docSection="Foundations"
      docUrl="useworkflow.dev/docs/foundations/workflows-and-steps"
      marker={["chargePayment", "notifyRestaurant"]}
      markerLabel="crash here"
    />
  );
}
