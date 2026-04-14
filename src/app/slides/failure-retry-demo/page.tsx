import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureRetryDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-retry"
      eyebrow="05a · The retry — watch it break"
      {...failureGroups["failure-retry"]}
      scenario={slideScenarios.naiveDoubleCharge}
      highlightSteps={["chargePayment"]}
    />
  );
}
