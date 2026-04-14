import { FixSlideLayout } from "../_components/fix-slide-layout";

export default function FailureRetryFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="05c · The retry — workflow code"
      headline="The charge ran twice."
      marker="chargePayment"
      markerLabel="payment flaked"
      workflowFix={{
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
      }}
    />
  );
}
