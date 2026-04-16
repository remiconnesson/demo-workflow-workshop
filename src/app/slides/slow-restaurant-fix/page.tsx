import { FixSlideLayout } from "../_components/fix-slide-layout";
import { scenarioGroups } from "../_data/scenario-groups";

export default function SlowRestaurantFixSlide() {
  return (
    <FixSlideLayout
      slide="slow-restaurant"
      eyebrow="06c / workflow code"
      {...scenarioGroups["slow-restaurant"]}
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
