import { FixSlideLayout } from "../_components/fix-slide-layout";
import { failureGroups } from "../_data/failure-groups";

export default function FailureAdminCancelFixSlide() {
  return (
    <FixSlideLayout
      slide="failure-admin-cancel"
      eyebrow="09c · Admin cancel — workflow code"
      {...failureGroups["failure-admin-cancel"]}
      workflowFix={{
        code: `async function placeOrder(orderId: string) {
  "use workflow"

  const cancelHook = createHook<{ cancelled: true; reason: string }>({
    token: \`order:\${orderId}:admin-cancel\`,
  })

  // Race the cancel hook against the decision window.
  const verdict = await Promise.race([
    cancelHook,
    sleep("6s").then(() => ({ cancelled: false as const })),
  ])

  if (verdict.cancelled) throw new Error("Admin cancel")
  // workflow catch {} runs saga compensations in reverse
}

// app/api/orders/[id]/cancel/route.ts
export async function POST(_: Request, { params }) {
  // resumeHook wakes the suspended workflow — no wakeUp needed.
  await resumeHook(\`order:\${params.id}:admin-cancel\`, {
    cancelled: true,
    reason: "support",
  })
  return Response.json({ ok: true })
}`,
      }}
    />
  );
}
