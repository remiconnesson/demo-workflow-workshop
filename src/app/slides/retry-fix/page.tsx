import { FixSlideLayout } from "../_components/fix-slide-layout";
import { scenarioGroups } from "../_data/scenario-groups";

export default function RetryFixSlide() {
  return (
    <FixSlideLayout
      slide="retry"
      eyebrow="05c / workflow code"
      {...scenarioGroups["retry"]}
      filename="chargePayment.ts"
      statusTone="red"
      steps={[
        {
          label: "Mark the durable boundary",
          detail: '"use step" wraps the side effect',
        },
        {
          label: "Grab a stable id",
          detail: "getStepMetadata().stepId survives retries",
        },
        {
          label: "Hand it to Stripe",
          detail: "idempotencyKey dedupes at the API",
        },
      ]}
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
