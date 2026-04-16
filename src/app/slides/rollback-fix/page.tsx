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
      }}
    />
  );
}
