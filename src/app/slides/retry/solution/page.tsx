import { FixSlideLayout } from "../../_components/fix-slide-layout";
import { scenarioGroups } from "../../_data/scenario-groups";

export default function RetryFixSlide() {
  return (
    <FixSlideLayout
      slide="retry"
      eyebrow="05c / workflow code"
      {...scenarioGroups["retry"]}
      filename="chargeCard.ts"
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
        highlightLines: {
          4: "Marks this function as a [durable step](https://workflow-sdk.dev/docs/foundations/workflows-and-steps) — if it crashes, the SDK [retries it automatically](https://workflow-sdk.dev/docs/foundations/errors-and-retries)",
          6: "A [stable ID](https://workflow-sdk.dev/docs/foundations/idempotency) that never changes across retries — your [deduplication key](https://workflow-sdk.dev/docs/foundations/idempotency)",
          10: "Stripe sees the [same key](https://workflow-sdk.dev/docs/foundations/idempotency) on retry → returns the original charge, **no double-billing**",
        },
        code: `// if this fails, it runs again
async function chargeCard(order) {
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
