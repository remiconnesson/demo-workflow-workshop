import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureFanOutDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-fan-out"
      eyebrow="12a · The fan-out — watch it scatter"
      {...failureGroups["failure-fan-out"]}
      scenario={slideScenarios.naiveAllOrNothing}
      highlightSteps={["sendReceipt"]}
    />
  );
}
