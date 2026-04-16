import { FixSlideLayout } from "../../_components/fix-slide-layout";
import { scenarioGroups } from "../../_data/scenario-groups";

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
          label: <>Mark the <code className="font-mono">durable boundary</code></>,
          detail: <><span className="text-zinc-300">&quot;use step&quot;</span> wraps the side effect</>,
        },
        {
          label: <>Grab a <code className="font-mono">stable id</code></>,
          detail: <><span className="text-zinc-300">getStepMetadata().stepId</span> survives retries</>,
        },
        {
          label: <>Hand it to <code className="font-mono">Stripe</code></>,
          detail: <><span className="text-zinc-300">idempotencyKey</span> dedupes at the API</>,
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
  return stripe.charges.create(
    { amount: order.total },
    { idempotencyKey: stepId },
  )
}`,
      }}
    />
  );
}
