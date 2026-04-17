import { FixSlideLayout } from "../../_components/fix-slide-layout";
import { scenarioGroups } from "../../_data/scenario-groups";

export default function RollbackFixSlide() {
  return (
    <FixSlideLayout
      slide="rollback"
      eyebrow="12c / workflow code"
      {...scenarioGroups["rollback"]}
      filename="placeOrder.ts"
      statusTone="fuchsia"
      steps={[
        {
          label: <>Open a dispute <code className="font-mono">hook</code></>,
          detail: <><span className="text-zinc-300">createHook</span> tokenized by orderId</>,
        },
        {
          label: <><code className="font-mono">Race</code> hook vs 24h <code className="font-mono">sleep</code></>,
          detail: <><span className="text-zinc-300">Promise.race</span> — whichever resolves first</>,
        },
        {
          label: <><code className="font-mono">Throw</code> on disputed verdict</>,
          detail: <>saga <span className="text-zinc-300">unwinds in reverse</span></>,
        },
      ]}
      workflowFix={{
        progression: [
          {
            code: `async function placeOrder(orderId: string) {
  "use workflow"
  // ...prior steps each pushed their undo onto the saga.

  // how do we catch a dispute within 24h of delivery?
  // poll the db? have another service call us?
}`,
          },
          {
            highlightLines: {
              6: "Opens a [dispute window](https://workflow-sdk.dev/docs/api-reference/workflow/create-hook) — any external system can [trigger it](https://workflow-sdk.dev/docs/foundations/hooks) via this token",
              7: "",
              8: "",
            },
            code: `async function placeOrder(orderId: string) {
  "use workflow"
  // ...prior steps each pushed their undo onto the saga.

  // open a post-delivery dispute window
  const disputeHook = createHook<{ reason: string }>({
    token: \`order:\${orderId}:delivery-dispute\`,
  })
}`,
          },
          {
            highlightLines: {
              10: "**Race**: customer disputes within 24 hours, or the window **closes cleanly**",
              11: "",
              12: "",
              13: "",
            },
            code: `async function placeOrder(orderId: string) {
  "use workflow"
  // ...prior steps each pushed their undo onto the saga.

  const disputeHook = createHook<{ reason: string }>({
    token: \`order:\${orderId}:delivery-dispute\`,
  })

  // race the dispute hook against a 24h closing window
  const verdict = await Promise.race([
    disputeHook.then((d) => ({ kind: "disputed" as const, ...d })),
    sleep("24h").then(() => ({ kind: "ok" as const })),
  ])
}`,
          },
          {
            highlightLines: {
              15: "Throwing triggers the [catch block](https://workflow-sdk.dev/docs/foundations/errors-and-retries) → every pushed compensation [runs in reverse](https://workflow-sdk.dev/docs/foundations/common-patterns)",
              16: "",
              17: "",
            },
            code: `async function placeOrder(orderId: string) {
  "use workflow"
  // ...prior steps each pushed their undo onto the saga.

  const disputeHook = createHook<{ reason: string }>({
    token: \`order:\${orderId}:delivery-dispute\`,
  })

  const verdict = await Promise.race([
    disputeHook.then((d) => ({ kind: "disputed" as const, ...d })),
    sleep("24h").then(() => ({ kind: "ok" as const })),
  ])

  // throw to unwind every saga compensation in reverse
  if (verdict.kind === "disputed") {
    throw new Error(\`Disputed: \${verdict.reason}\`)
  }
}`,
          },
        ],
        tabs: [
          {
            filename: "saga.ts",
            tone: "fuchsia",
            progression: [
              {
                code: `// no saga yet — how do we unwind on failure?
try {
  await reserveInventory(orderId)
  await chargeCard(orderId)
  await pingRestaurant(orderId)
} catch (e) {
  // undo by hand? in what order?
  throw e
}`,
              },
              {
                highlightLines: {
                  1: "Each successful step [pushes its own undo](https://workflow-sdk.dev/docs/foundations/common-patterns) onto a stack",
                  5: "",
                  8: "",
                  11: "",
                },
                code: `const rollbacks: Array<() => Promise<void>> = []

try {
  await reserveInventory(orderId)
  rollbacks.push(() => releaseInventory(orderId))

  await chargeCard(orderId)
  rollbacks.push(() => refundPayment(orderId))

  await pingRestaurant(orderId)
  rollbacks.push(() => cancelRestaurantOrder(orderId))
} catch (e) {
  throw e
}`,
              },
              {
                highlightLines: {
                  13: "The dispute hook is about to throw — **every push above is now pending unwind**",
                },
                code: `const rollbacks: Array<() => Promise<void>> = []

try {
  await reserveInventory(orderId)
  rollbacks.push(() => releaseInventory(orderId))

  await chargeCard(orderId)
  rollbacks.push(() => refundPayment(orderId))

  await pingRestaurant(orderId)
  rollbacks.push(() => cancelRestaurantOrder(orderId))

  // ... dispute hook throws here
} catch (e) {
  throw e
}`,
              },
              {
                highlightLines: {
                  15: "Unwind in [reverse order](https://workflow-sdk.dev/docs/foundations/common-patterns) — last step undone first, like **popping a stack**",
                  16: "",
                  17: "",
                  18: "",
                  19: "",
                  20: "",
                  21: "",
                  22: "",
                },
                code: `const rollbacks: Array<() => Promise<void>> = []

try {
  await reserveInventory(orderId)
  rollbacks.push(() => releaseInventory(orderId))

  await chargeCard(orderId)
  rollbacks.push(() => refundPayment(orderId))

  await pingRestaurant(orderId)
  rollbacks.push(() => cancelRestaurantOrder(orderId))

  // ... dispute hook throws here
} catch (e) {
  // unwind in reverse — each rollback is a "use step"
  // so it's durable and retried automatically
  for (const rollback of rollbacks.reverse()) {
    await rollback()
  }
  // → cancelRestaurantOrder ✓
  // → refundPayment ✓
  // → releaseInventory ✓

  throw e
}`,
              },
            ],
          },
        ],
      }}
    />
  );
}
