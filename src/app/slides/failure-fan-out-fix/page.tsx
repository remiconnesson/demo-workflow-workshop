import { FixSlideLayout } from "../_components/fix-slide-layout";

export default function FailureFanOutFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="12c · The fan-out — the fix"
      headline="Three notifications. One fails."
      marker="sendReceipt"
      markerLabel="parallel, still durable"
      workflowFix={{
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
      }}
    />
  );
}
