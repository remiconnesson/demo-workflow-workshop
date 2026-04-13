import { PatternSlideLayout } from "../_components/pattern-slide-layout";

export default function FailureCrashPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="04d · The pattern"
      patternName="Workflows and Steps"
      description="Mark a function as durable with two directives. The runtime records every completed step to an event log and replays deterministically on restart."
      apiPrimitive={`"use workflow"  ·  "use step"`}
      docSection="Foundations"
      docUrl="useworkflow.dev/docs/foundations/workflows-and-steps"
      marker={["chargePayment", "notifyRestaurant"]}
      markerLabel="crash here"
    />
  );
}
