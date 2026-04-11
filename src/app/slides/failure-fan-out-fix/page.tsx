import { FailureSlideLayout } from "../_components/failure-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

const WORKFLOW_FIX = {
  caption: "Promise.allSettled — each step is durable independently.",
  code: `"use workflow"

// each step checkpoints, retries,
// and replays on its own
await Promise.allSettled([
  emailReceipt(order),
  pushNotification(order),
  updateLoyalty(order),
])
// one fails? others still finish.`,
};

export default function FailureFanOutFixSlide() {
  return (
    <FailureSlideLayout
      slide="failure-fan-out"
      eyebrow="12b · The fan-out — the fix"
      headline="Three notifications. One fails."
      marker="sendReceipt"
      markerLabel="parallel, still durable"
      scenario={slideScenarios.failureFanOut}
      highlightSteps={["sendReceipt"]}
      workflowFix={WORKFLOW_FIX}
    />
  );
}
