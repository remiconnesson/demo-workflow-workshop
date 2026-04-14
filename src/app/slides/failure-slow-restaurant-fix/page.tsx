import { FixSlideLayout } from "../_components/fix-slide-layout";
import { failureGroups } from "../_data/failure-groups";

export default function FailureSlowRestaurantFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="06c · The slow restaurant — workflow code"
      {...failureGroups["failure-slow-restaurant"]}
      workflowFix={{
        code: `// createHook suspends the workflow.
// No webhook. No worker. No polling.
// (inside placeOrder — "use workflow")
const hook = createHook<{ accepted: boolean }>({
  token: \`order:\${orderId}:restaurant\`,
})

// workflow suspends here — no cost
const result = await hook

if (!result.accepted) {
  throw new FatalError("Rejected")
}`,
      }}
    />
  );
}
