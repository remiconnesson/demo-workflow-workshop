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
          label: <>Create a <code className="font-mono">webhook</code> URL and send it</>,
          detail: <><span className="text-zinc-300">createWebhook()</span> then pass <code className="font-mono">webhook.url</code> to the restaurant</>,
        },
        {
          label: <><code className="font-mono">Await</code> the webhook</>,
          detail: <>parks until the restaurant taps accept</>,
        },
        {
          label: <><code className="font-mono">Race</code> it against a 24h <code className="font-mono">sleep</code></>,
          detail: <><span className="text-zinc-300">Promise.race</span>, whichever resolves first</>,
        },
        {
          label: <><code className="font-mono">Throw</code> if the sleep wins</>,
          detail: <>the workflow fails cleanly instead of hanging forever</>,
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
              4: "Creates a [unique URL](https://workflow-sdk.dev/docs/api-reference/workflow/create-webhook) and **hands it to the restaurant**. They tap it to [wake this workflow up](https://workflow-sdk.dev/docs/foundations/hooks)",
            },
            code: `async function placeOrder(orderId: string) {
  "use workflow"
  // create a URL, then send it to the restaurant to tap
  using webhook = createWebhook()
  await pingRestaurant(orderId, webhook.url)
}`,
          },
          {
            highlightLines: {
              7: "Suspends the workflow until the restaurant [taps the URL we sent them](https://workflow-sdk.dev/docs/foundations/hooks). **But what if they never do?**",
            },
            code: `async function placeOrder(orderId: string) {
  "use workflow"
  using webhook = createWebhook()
  await pingRestaurant(orderId, webhook.url)

  // suspend until the restaurant taps the URL, but this blocks forever
  await webhook
}`,
          },
          {
            highlightLines: {
              7: "**First one wins**: the restaurant taps accept, or 24 hours pass",
              8: "",
              9: "[Durable sleep](https://workflow-sdk.dev/docs/api-reference/workflow/sleep). The process can shut down and restart; the **timer survives**",
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
              12: "Throw on timeout so the workflow fails cleanly instead of [hanging forever](https://workflow-sdk.dev/docs/foundations/errors-and-retries)",
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

  // throw on timeout so the workflow fails cleanly
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
