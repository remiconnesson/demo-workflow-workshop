import { FailureSlideLayout } from "../_components/failure-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

const WORKFLOW_FIX = {
  caption: "Every step gets a stable ID. Pass it as the idempotency key.",
  code: `async function chargePayment(order) {
  "use step"
  const { stepId } = getStepMetadata()
  return stripe.charges.create({
    amount: order.total,
    idempotencyKey: stepId,
  })
  // retries send the same key
  // Stripe deduplicates
}`,
};

export default function FailureRetryFixSlide() {
  return (
    <FailureSlideLayout
      slide="failure-retry"
      eyebrow="05b · The retry — the fix"
      headline="The charge ran twice."
      marker="chargePayment"
      markerLabel="payment flaked"
      scenario={slideScenarios.idempotency}
      highlightSteps={["chargePayment"]}
      workflowFix={WORKFLOW_FIX}
    />
  );
}
