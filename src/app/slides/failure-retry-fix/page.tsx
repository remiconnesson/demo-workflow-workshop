import { FixSlideLayout } from "../_components/fix-slide-layout";
import { failureGroups } from "../_data/failure-groups";

export default function FailureRetryFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="05c · The retry — workflow code"
      {...failureGroups["failure-retry"]}
      workflowFix={{
        code: `// Every step gets a stable ID.
// Pass it as the idempotency key.
async function chargePayment(order) {
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
