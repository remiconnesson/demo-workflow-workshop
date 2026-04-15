import { FixSlideLayout } from "../_components/fix-slide-layout";
import { failureGroups } from "../_data/failure-groups";

export default function FailureSlowRestaurantFixSlide() {
  return (
    <FixSlideLayout
      slide="failure-slow-restaurant"
      eyebrow="06c / workflow code"
      {...failureGroups["failure-slow-restaurant"]}
      filename="placeOrder.ts"
      statusTone="amber"
      steps={[
        {
          label: "Open a restaurant-accept hook",
          detail: "tokenized, durable, no worker",
        },
        {
          label: "Race hook vs 24h sleep",
          detail: "whichever resolves first",
        },
        {
          label: "Throw if the sleep wins",
          detail: "compensation triggers the refund",
        },
      ]}
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
