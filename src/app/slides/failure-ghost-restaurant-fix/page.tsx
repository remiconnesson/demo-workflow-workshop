import { FixSlideLayout } from "../_components/fix-slide-layout";
import { failureGroups } from "../_data/failure-groups";

export default function FailureGhostRestaurantFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="07c · The ghost — workflow code"
      {...failureGroups["failure-ghost-restaurant"]}
      workflowFix={{
        code: `async function placeOrder(orderId: string) {
  "use workflow"

  // Race the hook against a sleep.
  // Whichever resolves first wins.
  const hook = createHook<{ accepted: boolean }>({
    token: \`order:\${orderId}:restaurant-accept\`,
  })

  const result = await Promise.race([
    hook,
    sleep("2m").then(() => "timeout" as const),
  ])

  if (result === "timeout") {
    throw new Error("Restaurant timed out")
  }
}`,
      }}
    />
  );
}
