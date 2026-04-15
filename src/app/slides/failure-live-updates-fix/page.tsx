import { FixSlideLayout } from "../_components/fix-slide-layout";
import { failureGroups } from "../_data/failure-groups";

export default function FailureLiveUpdatesFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="10c · Live updates — workflow code"
      {...failureGroups["failure-live-updates"]}
      workflowFix={{
        code: `// Steps write to a stream. Client subscribes.
// No pubsub infrastructure.
async function chargePayment(order) {
  "use step"
  const w = getWritable().getWriter()
  try {
    await w.write({
      type: "step_running",
      step: "chargePayment", label: "Charge payment",
    })
    const result = await stripe.charge(order)
    await w.write({
      type: "step_succeeded",
      step: "chargePayment", label: "Charge payment",
    })
    return result
  } finally {
    w.releaseLock()
  }
}`,
      }}
    />
  );
}
