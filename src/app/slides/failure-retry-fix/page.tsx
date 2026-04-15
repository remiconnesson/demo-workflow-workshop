import { FixSlideLayout } from "../_components/fix-slide-layout";
import { failureGroups } from "../_data/failure-groups";

export default function FailureRetryFixSlide() {
  return (
    <FixSlideLayout
      slide="failure-retry"
      eyebrow="05c · The retry — workflow code"
      {...failureGroups["failure-retry"]}
      workflowFix={{
        code: `// if this fails, it runs again
async function chargePayment(order) {
  // "use step" marks the durable boundary...
  "use step"
  // ...and getStepMetadata hands you its identity
  const { stepId } = getStepMetadata()
  // lock it down with a stable id
  return stripe.charges.create({
    amount: order.total,
    idempotencyKey: stepId,
  })
}`,
      }}
    />
  );
}
