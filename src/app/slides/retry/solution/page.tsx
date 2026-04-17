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
        progression: [
          {
            code: `// if this fails, customers get double-charged
async function chargeCard(order) {
  return stripe.charges.create({
    amount: order.total,
  })
}`,
          },
          {
            highlightLines: {
              3: "Marks this function as a [durable step](https://workflow-sdk.dev/docs/foundations/workflows-and-steps) — if it crashes, the SDK [retries it automatically](https://workflow-sdk.dev/docs/foundations/errors-and-retries)",
            },
            code: `// if this fails, the SDK retries it
async function chargeCard(order) {
  "use step"
  return stripe.charges.create({
    amount: order.total,
  })
}`,
          },
          {
            highlightLines: {
              4: "A [stable ID](https://workflow-sdk.dev/docs/foundations/idempotency) that never changes across retries — your [deduplication key](https://workflow-sdk.dev/docs/foundations/idempotency)",
            },
            code: `// if this fails, the SDK retries it
async function chargeCard(order) {
  "use step"
  const { stepId } = getStepMetadata()
  return stripe.charges.create({
    amount: order.total,
  })
}`,
          },
          {
            highlightLines: {
              7: "Stripe sees the [same key](https://workflow-sdk.dev/docs/foundations/idempotency) on retry → returns the original charge, **no double-billing**",
            },
            code: `// if this fails, the SDK retries it
async function chargeCard(order) {
  "use step"
  const { stepId } = getStepMetadata()
  return stripe.charges.create(
    { amount: order.total },
    { idempotencyKey: stepId },
  )
}`,
          },
        ],
      }}
    />
  );
}
