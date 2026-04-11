import { FailureSlideLayout } from "../_components/failure-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

const WORKFLOW_FIX = {
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
};

export default function FailureLiveUpdatesFixSlide() {
  return (
    <FailureSlideLayout
      slide="failure-live-updates"
      eyebrow="11b · Live updates — the fix"
      headline="The customer is staring at a spinner."
      marker="span"
      markerLabel="streamed end-to-end"
      scenario={slideScenarios.streaming}
      workflowFix={WORKFLOW_FIX}
    />
  );
}
