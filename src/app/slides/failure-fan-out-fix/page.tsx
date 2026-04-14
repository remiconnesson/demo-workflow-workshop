import { FixSlideLayout } from "../_components/fix-slide-layout";

export default function FailureFanOutFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="12c · The fan-out — the fix"
      headline="Three notifications. One fails."
      marker="sendReceipt"
      markerLabel="parallel, still durable"
      workflowFix={{
        caption: "Promise.allSettled across separate steps gives each branch its own durable boundary.",
        code: `"use workflow"

// put each branch in its own step
// for per-branch durability
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
