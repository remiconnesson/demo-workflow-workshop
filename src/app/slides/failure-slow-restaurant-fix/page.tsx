import { FixSlideLayout } from "../_components/fix-slide-layout";
import { failureGroups } from "../_data/failure-groups";

export default function FailureSlowRestaurantFixSlide() {
  return (
    <FixSlideLayout
      slide="failure-slow-restaurant"
      eyebrow="06c · The slow restaurant — workflow code"
      {...failureGroups["failure-slow-restaurant"]}
      workflowFix={{
        code: `async function placeOrder(orderId: string) {
  "use workflow"

  // createHook suspends the workflow.
  // No webhook. No worker. No polling.
  const hook = createHook<{ accepted: boolean }>({
    token: \`order:\${orderId}:restaurant-accept\`,
  })

  // Race the hook against a 24h sleep.
  const result = await Promise.race([
    hook,
    sleep("24h").then(() => ({ accepted: false })),
  ])

  if (!result.accepted) {
    throw new Error("Restaurant never accepted")
  }
}`,
      }}
    />
  );
}
