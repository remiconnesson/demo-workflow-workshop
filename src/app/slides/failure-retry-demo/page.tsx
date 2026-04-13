import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureRetryDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-retry"
      eyebrow="05a · The retry — watch it break"
      headline="Your customer just got charged twice."
      marker="chargePayment"
      markerLabel="payment flaked"
      scenario={slideScenarios.idempotency}
      highlightSteps={["chargePayment"]}
    />
  );
}
