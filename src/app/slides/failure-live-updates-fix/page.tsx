import { FixSlideLayout } from "../_components/fix-slide-layout";
import { failureGroups } from "../_data/failure-groups";

export default function FailureLiveUpdatesFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="11c · Live updates — workflow code"
      {...failureGroups["failure-live-updates"]}
      workflowFix={{
        code: `// Steps write to a stream. Client subscribes.
// No pubsub infrastructure.
async function chargePayment(order) {
  "use step"
  const w = getWritable().getWriter()
  await w.write({
    step: "charge", status: "running",
  })
  const result = await stripe.charge(order)
  await w.write({
    step: "charge", status: "done",
  })
  w.releaseLock()
  return result
}`,
      }}
    />
  );
}
