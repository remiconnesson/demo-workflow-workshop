import { PatternSlideLayout } from "../_components/pattern-slide-layout";

export default function FailurePrepWindowPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="08d · The wait — concept / pattern"
      patternName="Scheduling"
      description="Pause a workflow for minutes, hours, or days without holding a connection or paying for compute. The runtime wakes it up on time — even across restarts."
      apiPrimitive={`await sleep('20m')`}
      docSection="Cookbook · Common Patterns"
      docUrl="useworkflow.dev/docs/cookbook/common-patterns/scheduling"
      marker={["chargePayment", "notifyRestaurant"]}
      markerLabel="20 min sleep"
    />
  );
}
