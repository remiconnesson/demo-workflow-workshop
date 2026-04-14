import { FixSlideLayout } from "../_components/fix-slide-layout";
import { failureGroups } from "../_data/failure-groups";

export default function FailureFanOutFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="11c · The fan-out — workflow code"
      {...failureGroups["failure-fan-out"]}
      workflowFix={{
        code: `// Promise.allSettled across separate steps
// gives each branch its own durable boundary.
"use workflow"

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
