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
        highlightLines: {
          7: "Opens a [dispute window](https://workflow-sdk.dev/docs/api-reference/workflow/create-hook) — any external system can [trigger it](https://workflow-sdk.dev/docs/foundations/hooks) via this token",
          8: "",
          9: "",
          11: "**Race**: customer disputes within 24 hours, or the window **closes cleanly**",
          12: "",
          13: "",
          14: "",
          19: "This **throw** triggers the [catch block](https://workflow-sdk.dev/docs/foundations/errors-and-retries) → every pushed compensation [runs in reverse](https://workflow-sdk.dev/docs/foundations/common-patterns)",
        },
        code: `async function placeOrder(orderId: string) {
  "use workflow"

  // ...prior steps each pushed their undo onto the saga.

  // Open a post-delivery dispute window.
  const disputeHook = createHook<{ reason: string }>({
    token: \`order:\${orderId}:delivery-dispute\`,
  })

  const verdict = await Promise.race([
    disputeHook.then((d) => ({ kind: "disputed" as const, ...d })),
    sleep("24h").then(() => ({ kind: "ok" as const })),
  ])

  if (verdict.kind === "disputed") {
    // Workflow catch {} unwinds every compensation in reverse.
    throw new Error(\`Disputed: \${verdict.reason}\`)
  }
}`,
        tabs: [
          {
            filename: "saga.ts",
            highlightLines: {
              5: "Each successful step [pushes its own undo](https://workflow-sdk.dev/docs/foundations/common-patterns) — if anything fails later, **this runs**",
              8: "",
              11: "",
              17: "Unwind in [reverse order](https://workflow-sdk.dev/docs/foundations/common-patterns) — last step undone first, like **popping a stack**",
            },
            code: `const rollbacks: Array<() => Promise<void>> = []

try {
  await reserveInventory(orderId)
  rollbacks.push(() => releaseInventory(orderId))

  await chargePayment(orderId)
  rollbacks.push(() => refundPayment(orderId))

  await notifyRestaurant(orderId)
  rollbacks.push(() => cancelRestaurantOrder(orderId))

  // ... dispute hook throws here
} catch (e) {
  // Unwind in reverse — each rollback is a "use step"
  // so it's durable and retried automatically.
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
      }}
    />
  );
}
