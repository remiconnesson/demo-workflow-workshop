import { FixSlideLayout } from "../_components/fix-slide-layout";
import { scenarioGroups } from "../_data/scenario-groups";

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
          label: "Open a dispute hook",
          detail: "tokenized by orderId",
        },
        {
          label: "Race hook vs 24h sleep",
          detail: "whichever resolves first",
        },
        {
          label: "Throw on disputed verdict",
          detail: "saga unwinds in reverse",
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
            directive: "catch → unwind",
            directiveTone: "fuchsia",
            code: `// Each prior step pushed its undo onto the stack:
//   [ refundPayment, cancelRestaurantOrder, releaseDriver ]

try {
  await placeOrderSteps(input) // throws "Disputed: cold, bag torn"
} catch (error) {
  console.error(error)
  // → Error: Disputed: cold, bag torn

  // Pop the saga in reverse (LIFO) and run each undo.
  while (compensations.length > 0) {
    const { action, undo } = compensations.pop()!
    await undo()
    console.info("[saga] compensated", { action })
  }
  // → [saga] compensated { action: "releaseDriver" }
  // → [saga] compensated { action: "cancelRestaurantOrder" }
  // → [saga] compensated { action: "refundPayment" }

  throw error // re-throw so the run is marked rolled_back
}`,
          },
        ],
      }}
    />
  );
}
