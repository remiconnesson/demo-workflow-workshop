import { FixSlideLayout } from "../../_components/fix-slide-layout";
import { scenarioGroups } from "../../_data/scenario-groups";

export default function SuspendFixSlide() {
  return (
    <FixSlideLayout
      slide="suspend"
      eyebrow="06c / workflow code"
      {...scenarioGroups["suspend"]}
      filename="placeOrder.ts"
      statusTone="amber"
      steps={[
        {
          label: <>Create a <code className="font-mono">webhook</code> URL</>,
          detail: <><span className="text-zinc-300">createWebhook()</span> — one line, no custom route</>,
        },
        {
          label: <><code className="font-mono">Race</code> webhook vs 24h <code className="font-mono">sleep</code></>,
          detail: <><span className="text-zinc-300">Promise.race</span> — whichever resolves first</>,
        },
        {
          label: <><code className="font-mono">Throw</code> if the sleep wins</>,
          detail: <>compensation triggers the refund</>,
        },
      ]}
      workflowFix={{
        code: `async function placeOrder(orderId: string) {
  "use workflow"

  // createWebhook suspends the workflow.
  // One URL. No route. No polling.
  using webhook = createWebhook()

  // Send the accept link to the restaurant
  await notifyRestaurant(orderId, webhook.url)

  // Race: restaurant taps accept vs 24h timeout
  const accepted = await Promise.race([
    webhook.then(() => true),
    sleep("24h").then(() => false),
  ])

  if (!accepted) {
    throw new Error("Restaurant never accepted")
  }
}`,
      }}
    />
  );
}
