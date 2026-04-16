import { DurableAgent } from "@workflow/ai/agent";
import { defineHook, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

import { FLEET, PICKUP, DROPOFF } from "./dispatch-retry";

// ---------------------------------------------------------------------------
// Dispatch · Rollback (Chapter 3)
//
// Previously on Dispatch:
//   Ch.1 (dispatch-retry)  — Mika Tanaka was dispatched for ord-9421 from
//                            Tartine → 201 Spear St. A GPS ping flaked once,
//                            the runtime retried, Mika got the run.
//   Ch.2 (dispatch-suspend) — Mika hit a Bay Bridge on-ramp closure and
//                            disputed. The agent suspended, the dispatcher
//                            approved, Priya Shah was reassigned.
//
// Chapter 3: Priya has accepted the reroute, the customer has been notified
// of the new ETA, and Priya's driver app has the push route locked. Then
// the Tartine kitchen calls dispatch — the wrong bag was packed for
// ord-9421. The agent must UNWIND the dispatch in reverse:
//     1. pushRouteToDriverApp  (forward)  → recallRouteFromDriverApp
//     2. notifyCustomerOfEta   (forward)  → notifyCustomerOfCancellation
//     3. commitReassignment    (forward)  → releaseDriverFromOrder
//
// The rollback is triggered by a UI button that resumes a hook whose token
// is `dispatch-rollback:ord-9421`. The agent detects the dispute inside
// the same loop, iterates its compensation manifest in REVERSE order, and
// replies with a one-sentence postmortem.
// ---------------------------------------------------------------------------

export const dispatchRollbackHook = defineHook({
  schema: z.object({
    disputed: z.boolean(),
    reason: z.string().optional(),
  }),
});

// A forward step returns a manifest entry the agent records; the rollback
// phase reads this manifest and invokes the corresponding compensation.
type ForwardAction = "commitReassignment" | "notifyCustomerOfEta" | "pushRouteToDriverApp";

// ---------------------------------------------------------------------------
// Forward step-backed tools (mutate state)
// ---------------------------------------------------------------------------

async function commitReassignment({
  orderId,
  driverId,
}: {
  orderId: string;
  driverId: string;
}) {
  "use step";
  const driver = FLEET.find((d) => d.id === driverId);
  return {
    ok: true as const,
    forward: "commitReassignment" as ForwardAction,
    orderId,
    driverId,
    driverName: driver?.name ?? driverId,
    etaMin: Math.round((driver?.distanceMi ?? 1) * 4 + 3),
    committedAt: new Date().toISOString(),
  };
}

async function notifyCustomerOfEta({
  orderId,
  etaMin,
  driverName,
}: {
  orderId: string;
  etaMin: number;
  driverName: string;
}) {
  "use step";
  return {
    ok: true as const,
    forward: "notifyCustomerOfEta" as ForwardAction,
    orderId,
    channel: "sms" as const,
    to: "+1-415-555-0199",
    message: `Your Tartine order is on the way with ${driverName}. ETA ${etaMin}m.`,
    deliveredAt: new Date().toISOString(),
  };
}

async function pushRouteToDriverApp({
  orderId,
  driverId,
}: {
  orderId: string;
  driverId: string;
}) {
  "use step";
  return {
    ok: true as const,
    forward: "pushRouteToDriverApp" as ForwardAction,
    orderId,
    driverId,
    pickup: PICKUP.address,
    dropoff: DROPOFF.address,
    legs: 2,
    pushedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Compensation step-backed tools (undo forward actions)
// ---------------------------------------------------------------------------

async function recallRouteFromDriverApp({
  orderId,
  driverId,
}: {
  orderId: string;
  driverId: string;
}) {
  "use step";
  return {
    undone: "pushRouteToDriverApp" as ForwardAction,
    orderId,
    driverId,
    recalledAt: new Date().toISOString(),
    detail: "Route revoked from driver phone; nav cleared.",
  };
}

async function notifyCustomerOfCancellation({
  orderId,
  reason,
}: {
  orderId: string;
  reason: string;
}) {
  "use step";
  return {
    undone: "notifyCustomerOfEta" as ForwardAction,
    orderId,
    channel: "sms" as const,
    to: "+1-415-555-0199",
    message: `Sorry — ${reason}. We're refunding your order now.`,
    sentAt: new Date().toISOString(),
  };
}

async function releaseDriverFromOrder({
  orderId,
  driverId,
}: {
  orderId: string;
  driverId: string;
}) {
  "use step";
  const driver = FLEET.find((d) => d.id === driverId);
  return {
    undone: "commitReassignment" as ForwardAction,
    orderId,
    driverId,
    driverName: driver?.name ?? driverId,
    releasedAt: new Date().toISOString(),
    detail: `${driver?.name ?? driverId} is back in the available pool.`,
  };
}

// ---------------------------------------------------------------------------
// Workflow-level tool: await the kitchen dispute hook
// NOTE: no "use step" — hooks must be awaited at workflow level.
// ---------------------------------------------------------------------------

async function awaitKitchenDispute({ orderId }: { orderId: string }) {
  const token = `dispatch-rollback:${orderId}`;
  const hook = dispatchRollbackHook.create({ token });
  const decision = await hook;
  hook.dispose();
  return {
    orderId,
    token,
    disputed: decision.disputed,
    reason: decision.reason ?? "wrong_bag_packed",
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function dispatchRollbackWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Dispatch agent for a food-delivery fleet — Chapter 3.",
      `Order ord-9421 (${PICKUP.name} → ${DROPOFF.address}) was just`,
      "reassigned to Priya Shah (drv-priya) after a dispatcher approval in",
      "Chapter 2. Your job is to finish the hand-off, then listen for a",
      "kitchen dispute that may force a full rollback.",
      "",
      "FORWARD PHASE — run these tools in order, exactly once each:",
      "1. commitReassignment(orderId='ord-9421', driverId='drv-priya').",
      "2. notifyCustomerOfEta with the etaMin and driverName you received",
      "   from step 1.",
      "3. pushRouteToDriverApp(orderId='ord-9421', driverId='drv-priya').",
      "",
      "DISPUTE PHASE:",
      "4. Call awaitKitchenDispute(orderId='ord-9421'). This suspends the",
      "   workflow until the Tartine kitchen reports a problem. Wait for",
      "   the result — do not retry.",
      "",
      "ROLLBACK PHASE — only if the dispute result has disputed=true, run",
      "the compensations in EXACT REVERSE ORDER of the forward phase:",
      "5. recallRouteFromDriverApp(orderId='ord-9421', driverId='drv-priya')",
      "   — undoes step 3.",
      "6. notifyCustomerOfCancellation(orderId='ord-9421', reason=<the",
      "   reason from the dispute>) — undoes step 2.",
      "7. releaseDriverFromOrder(orderId='ord-9421', driverId='drv-priya')",
      "   — undoes step 1.",
      "",
      "8. Reply with ONE sentence naming what went wrong and confirming the",
      "   rollback is complete. Do not call any more tools after step 7.",
    ].join(" "),
    tools: {
      commitReassignment: {
        description:
          "Lock Priya Shah to order ord-9421 and return the ETA. Forward action #1.",
        inputSchema: z.object({
          orderId: z.string(),
          driverId: z.string(),
        }),
        execute: commitReassignment,
      },
      notifyCustomerOfEta: {
        description:
          "Send the customer an SMS with the new driver name and ETA. Forward action #2.",
        inputSchema: z.object({
          orderId: z.string(),
          etaMin: z.number().int(),
          driverName: z.string(),
        }),
        execute: notifyCustomerOfEta,
      },
      pushRouteToDriverApp: {
        description:
          "Push pickup + dropoff route to the driver's phone app. Forward action #3.",
        inputSchema: z.object({
          orderId: z.string(),
          driverId: z.string(),
        }),
        execute: pushRouteToDriverApp,
      },
      awaitKitchenDispute: {
        description:
          "Suspend the workflow and wait for the Tartine kitchen to confirm or dispute the order. Returns { disputed, reason } once the kitchen reports in.",
        inputSchema: z.object({ orderId: z.string() }),
        execute: awaitKitchenDispute,
      },
      recallRouteFromDriverApp: {
        description:
          "Compensation for pushRouteToDriverApp — revoke the route from the driver's phone.",
        inputSchema: z.object({
          orderId: z.string(),
          driverId: z.string(),
        }),
        execute: recallRouteFromDriverApp,
      },
      notifyCustomerOfCancellation: {
        description:
          "Compensation for notifyCustomerOfEta — SMS the customer that the order is cancelled and a refund is on the way.",
        inputSchema: z.object({
          orderId: z.string(),
          reason: z.string(),
        }),
        execute: notifyCustomerOfCancellation,
      },
      releaseDriverFromOrder: {
        description:
          "Compensation for commitReassignment — release the driver back into the available pool.",
        inputSchema: z.object({
          orderId: z.string(),
          driverId: z.string(),
        }),
        execute: releaseDriverFromOrder,
      },
    },
  });

  const result = await agent.stream({
    messages: [
      {
        role: "user",
        content:
          "Finish the hand-off to Priya for ord-9421 and stand by for the kitchen's final check.",
      },
    ],
    writable,
    collectUIMessages: true,
    maxSteps: 14,
  });

  return { messages: result.messages, uiMessages: result.uiMessages };
}
