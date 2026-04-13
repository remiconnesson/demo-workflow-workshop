import { FixSlideLayout } from "../_components/fix-slide-layout";

export default function FailureLiveUpdatesFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="11c · Live updates — the fix"
      headline="The customer is staring at a spinner."
      marker="span"
      markerLabel="streamed end-to-end"
      workflowFix={{
        caption: "Steps write to a stream. Client subscribes. No pubsub infrastructure.",
        code: `async function chargePayment(order) {
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
