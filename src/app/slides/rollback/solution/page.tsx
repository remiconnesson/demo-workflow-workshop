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
          label: <>Each success <code className="font-mono">pushes</code> its undo</>,
          detail: <>rollbacks <span className="text-zinc-300">stack up</span> as steps complete</>,
        },
        {
          label: <><code className="font-mono">Race</code> a dispute hook vs 24h <code className="font-mono">sleep</code></>,
          detail: <>throw if the customer <span className="text-zinc-300">disputes</span></>,
        },
        {
          label: <><code className="font-mono">Reverse</code> the stack in catch</>,
          detail: <>last pushed, <span className="text-zinc-300">first unwound</span></>,
        },
      ]}
      workflowFix={{
        progression: [
          {
            code: `async function placeOrder(orderId: string) {
  "use workflow"

  try {
    await reserveInventory(orderId)
    await chargeCard(orderId)
    await pingRestaurant(orderId)
    // how do we catch a dispute within 24h — and unwind if so?
  } catch (e) {
    throw e
  }
}`,
          },
          {
            highlightLines: {
              3: "Each successful step [pushes its own undo](https://workflow-sdk.dev/docs/foundations/common-patterns) onto a stack",
              7: "",
              10: "",
              13: "",
            },
            code: `async function placeOrder(orderId: string) {
  "use workflow"
  const rollbacks: Array<() => Promise<void>> = []

  try {
    await reserveInventory(orderId)
    rollbacks.push(() => releaseInventory(orderId))

    await chargeCard(orderId)
    rollbacks.push(() => refundPayment(orderId))

    await pingRestaurant(orderId)
    rollbacks.push(() => cancelRestaurantOrder(orderId))
  } catch (e) {
    throw e
  }
}`,
          },
          {
            highlightLines: {
              15: "This hook pauses until **something outside** wakes it. See the `/dispute` route tab →",
              16: "[createHook](https://workflow-sdk.dev/docs/api-reference/workflow/create-hook) registers a promise keyed by token",
              17: "**This token string is the wiring** — the route computes the same string to resolve this hook",
              18: "",
              20: "**Race**: customer disputes within 24 hours, or the window **closes cleanly**",
              21: "",
              22: "",
              23: "",
              25: "Throwing routes execution to the [catch block](https://workflow-sdk.dev/docs/foundations/errors-and-retries) below",
              26: "",
              27: "",
            },
            code: `async function placeOrder(orderId: string) {
  "use workflow"
  const rollbacks: Array<() => Promise<void>> = []

  try {
    await reserveInventory(orderId)
    rollbacks.push(() => releaseInventory(orderId))

    await chargeCard(orderId)
    rollbacks.push(() => refundPayment(orderId))

    await pingRestaurant(orderId)
    rollbacks.push(() => cancelRestaurantOrder(orderId))

    // paused until the /dispute route fires (see route tab →)
    const disputeHook = createHook<{ reason: string }>({
      token: \`order:\${orderId}:delivery-dispute\`,
    })

    const verdict = await Promise.race([
      disputeHook.then((d) => ({ kind: "disputed" as const, ...d })),
      sleep("24h").then(() => ({ kind: "ok" as const })),
    ])

    if (verdict.kind === "disputed") {
      throw new Error(\`Disputed: \${verdict.reason}\`)
    }
  } catch (e) {
    throw e
  }
}`,
          },
          {
            highlightLines: {
              30: "Unwind in [reverse order](https://workflow-sdk.dev/docs/foundations/common-patterns) — last pushed, **first undone**",
              31: "",
              32: "",
              33: "",
              34: "",
              35: "",
              36: "",
            },
            code: `async function placeOrder(orderId: string) {
  "use workflow"
  const rollbacks: Array<() => Promise<void>> = []

  try {
    await reserveInventory(orderId)
    rollbacks.push(() => releaseInventory(orderId))

    await chargeCard(orderId)
    rollbacks.push(() => refundPayment(orderId))

    await pingRestaurant(orderId)
    rollbacks.push(() => cancelRestaurantOrder(orderId))

    // paused until the /dispute route fires (see route tab →)
    const disputeHook = createHook<{ reason: string }>({
      token: \`order:\${orderId}:delivery-dispute\`,
    })

    const verdict = await Promise.race([
      disputeHook.then((d) => ({ kind: "disputed" as const, ...d })),
      sleep("24h").then(() => ({ kind: "ok" as const })),
    ])

    if (verdict.kind === "disputed") {
      throw new Error(\`Disputed: \${verdict.reason}\`)
    }
  } catch (e) {
    // unwind in reverse — each rollback is a "use step"
    // so it's durable and retried automatically
    for (const rollback of rollbacks.reverse()) {
      await rollback()
    }
    // → cancelRestaurantOrder ✓ → refundPayment ✓ → releaseInventory ✓
    throw e
  }
}`,
          },
        ],
        tabs: [
          {
            filename: "dispute/route.ts",
            tone: "sky",
            progression: [
              {
                code: `// src/app/api/orders/[orderId]/dispute/route.ts
// A plain Next.js route — nothing workflow-specific yet.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params
  // customer just disputed — how do we wake the paused workflow?
  return Response.json({ ok: true })
}`,
              },
              {
                highlightLines: {
                  1: "[resumeHook](https://workflow-sdk.dev/docs/api-reference/workflow/resume-hook) is an SDK function — any server code (route, tool, webhook) can import and call it",
                  2: "",
                  11: "**Same token string** the workflow passes to createHook — that's the entire mapping",
                  12: "",
                  13: "",
                  14: "",
                },
                code: `// src/app/api/orders/[orderId]/dispute/route.ts
import { resumeHook } from "workflow/api"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params
  const { reason } = await req.json()

  // same string as the workflow's createHook token →
  await resumeHook(
    \`order:\${orderId}:delivery-dispute\`,
    { reason },
  )

  return Response.json({ ok: true })
}`,
              },
            ],
          },
        ],
      }}
    />
  );
}
