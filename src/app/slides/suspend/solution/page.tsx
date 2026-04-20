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
          label: <><code className="font-mono">Await</code> the webhook</>,
          detail: <>parks until the restaurant taps accept</>,
        },
        {
          label: <><code className="font-mono">Race</code> it against a 24h <code className="font-mono">sleep</code></>,
          detail: <><span className="text-zinc-300">Promise.race</span> — whichever resolves first</>,
        },
        {
          label: <><code className="font-mono">Throw</code> if the sleep wins</>,
          detail: <>compensation triggers the refund</>,
        },
      ]}
      workflowFix={{
        progression: [
          {
            code: `async function placeOrder(orderId: string) {
  // how do you wait 24h for a human to tap accept?
  await pingRestaurant(orderId)
  // ...then poll? block? timeout after 30s?
}`,
          },
          {
            highlightLines: {
              4: "Creates a [unique URL](https://workflow-sdk.dev/docs/api-reference/workflow/create-webhook) that [wakes this workflow up](https://workflow-sdk.dev/docs/foundations/hooks) — **no custom route, no polling**",
            },
            code: `async function placeOrder(orderId: string) {
  "use workflow"
  // one URL the restaurant can hit to resume us
  using webhook = createWebhook()
  await pingRestaurant(orderId, webhook.url)
}`,
          },
          {
            highlightLines: {
              7: "Suspends the workflow until the restaurant [hits the webhook URL](https://workflow-sdk.dev/docs/foundations/hooks) — **but what if they never do?**",
            },
            code: `async function placeOrder(orderId: string) {
  "use workflow"
  using webhook = createWebhook()
  await pingRestaurant(orderId, webhook.url)

  // await the webhook — but this blocks forever
  await webhook
}`,
          },
          {
            highlightLines: {
              7: "**First one wins**: the restaurant taps accept, or 24 hours pass",
              8: "",
              9: "[Durable sleep](https://workflow-sdk.dev/docs/api-reference/workflow/sleep) — the process can shut down and restart; the **timer survives**",
              10: "",
            },
            code: `async function placeOrder(orderId: string) {
  "use workflow"
  using webhook = createWebhook()
  await pingRestaurant(orderId, webhook.url)

  // race the webhook against a 24h durable timer
  const accepted = await Promise.race([
    webhook.then(() => true),
    sleep("24h").then(() => false),
  ])
}`,
          },
          {
            highlightLines: {
              12: "Throwing enters the [catch block](https://workflow-sdk.dev/docs/foundations/errors-and-retries) — your rollback steps [run in reverse](https://workflow-sdk.dev/docs/foundations/common-patterns)",
              13: "",
              14: "",
            },
            code: `async function placeOrder(orderId: string) {
  "use workflow"
  using webhook = createWebhook()
  await pingRestaurant(orderId, webhook.url)

  const accepted = await Promise.race([
    webhook.then(() => true),
    sleep("24h").then(() => false),
  ])

  // throw on timeout → compensation unwinds the order
  if (!accepted) {
    throw new Error("Restaurant never accepted")
  }
}`,
          },
        ],
      }}
    />
  );
}
