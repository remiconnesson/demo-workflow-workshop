import { DemoSlideLayout } from "../../_components/demo-slide-layout";
import { scenarioGroups } from "../../_data/scenario-groups";
import { slideScenarios } from "../../_lib/slide-scenarios";

export default function RetryDemoSlide() {
  return (
    <DemoSlideLayout
      slide="retry"
      eyebrow="05a · The retry"
      {...scenarioGroups["retry"]}
      subcopy="A flaky charge is where idempotency earns its keep — the workflow retries the step without double-billing the customer."
      scenario={slideScenarios.naiveDoubleCharge}
      highlightSteps={["chargePayment"]}
    />
  );
}
