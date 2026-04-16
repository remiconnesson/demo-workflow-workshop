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
