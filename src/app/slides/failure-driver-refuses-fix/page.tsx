import { FixSlideLayout } from "../_components/fix-slide-layout";
import { failureGroups } from "../_data/failure-groups";

export default function FailureDriverRefusesFixSlide() {
  return (
    <FixSlideLayout
      slide="failure-driver-refuses"
      eyebrow="12c · The dispute — workflow code"
      {...failureGroups["failure-driver-refuses"]}
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
