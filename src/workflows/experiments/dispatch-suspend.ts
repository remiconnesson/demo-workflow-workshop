import { DurableAgent } from "@workflow/ai/agent";
import { defineHook, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

import { FLEET, PICKUP, DROPOFF } from "./dispatch-retry";

// ---------------------------------------------------------------------------
// Dispatch · Suspend (Chapter 2)
//
// In Chapter 1 (dispatch-retry), the DurableAgent dispatched Mika Tanaka
// (drv-mika, scooter, SOMA) for order ord-9421 from Tartine → 201 Spear St.
// The GPS ping flaked once, the runtime retried, and Mika was assigned.
//
// Chapter 2: 90 seconds later, Mika's phone pings the dispatch service with
// a DISPUTE — she's stuck behind a Bay Bridge on-ramp closure and asking to
// hand the order off. The DurableAgent picks up, re-lists SOMA drivers,
// identifies Priya Shah (drv-priya, car, SOMA, 0.9mi) as the reroute
// candidate, and then must SUSPEND: bumping Mika and reassigning Priya is
// a revenue decision that needs a human. It awaits the approvalHook
// (token: `dispatch-suspend:ord-9421`). The ops operator approves (or
// rejects) from the phone. The agent resumes mid-loop, re-assigns Priya
// (or gives Mika more time), and replies.
// ---------------------------------------------------------------------------

// Slug-local hook so this demo is self-contained and won't collide with
// other suspend demos that share `approvalHook`.
export const dispatchSuspendHook = defineHook({
  schema: z.object({
    approved: z.boolean(),
    reason: z.string().optional(),
  }),
});

// ---------------------------------------------------------------------------
// Step-backed tools
// ---------------------------------------------------------------------------

async function getCurrentAssignment({ orderId }: { orderId: string }) {
  "use step";
  // Chapter 1's outcome, durably "remembered" for chapter 2.
  return {
    orderId,
    driverId: "drv-mika",
    driverName: "Mika Tanaka",
    vehicle: "scooter",
    zone: "SOMA",
    assignedAtMinAgo: 2,
    etaMinOriginal: 5,
  } as const;
}

async function readDriverDispute({ driverId }: { driverId: string }) {
  "use step";
  const driver = FLEET.find((d) => d.id === driverId);
  return {
    driverId,
    driverName: driver?.name ?? driverId,
    kind: "reroute_request" as const,
    reason: "Bay Bridge on-ramp closure — stuck, can't reach pickup",
    reportedEtaDelayMin: 14,
    revenueRiskUsd: 38,
  };
}

async function listAvailableDriversExcluding({
  zone,
  excludeDriverId,
}: {
  zone: string;
  excludeDriverId: string;
}) {
  "use step";
  return FLEET.filter(
    (d) => d.zone === zone && d.id !== excludeDriverId,
  ).map((d) => ({
    id: d.id,
    name: d.name,
    vehicle: d.vehicle,
    distanceMi: d.distanceMi,
  }));
}

async function refindDriver({
  orderId,
  fromDriverId,
  toDriverId,
}: {
  orderId: string;
  fromDriverId: string;
  toDriverId: string;
}) {
  "use step";
  const to = FLEET.find((d) => d.id === toDriverId);
  if (!to) {
    return { reassigned: false, error: "driver_not_found" } as const;
  }
  return {
    reassigned: true,
    orderId,
    fromDriverId,
    toDriverId,
    toDriverName: to.name,
    etaMin: Math.round(to.distanceMi * 4 + 3),
  } as const;
}

async function holdAssignment({
  orderId,
  extraEtaMin,
}: {
  orderId: string;
  extraEtaMin: number;
}) {
  "use step";
  return {
    held: true,
    orderId,
    extraEtaMin,
    message: "Sticking with original driver — giving them more time.",
  } as const;
}

// ---------------------------------------------------------------------------
// Workflow-level tool: suspend and await dispatcher approval
// NOTE: no "use step" directive — hooks must be awaited at workflow level.
// ---------------------------------------------------------------------------

async function requestReassignApproval({
  orderId,
  fromDriverId,
  toDriverId,
  rationale,
}: {
  orderId: string;
  fromDriverId: string;
  toDriverId: string;
  rationale: string;
}) {
  // Deterministic token the UI can POST to without parsing the stream.
  const token = `dispatch-suspend:${orderId}`;
  const hook = dispatchSuspendHook.create({ token });

  const decision = await hook;
  hook.dispose();

  return {
    orderId,
    fromDriverId,
    toDriverId,
    rationale,
    approved: decision.approved,
    reason: decision.reason ?? null,
    token,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function dispatchSuspendWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Dispatch agent for a food-delivery fleet — Chapter 2.",
      `Order ord-9421 (${PICKUP.name} → ${DROPOFF.address}) was already`,
      "assigned to Mika Tanaka (drv-mika) in SOMA. Now her phone filed a",
      "dispute. Your job:",
      "1. Call getCurrentAssignment for ord-9421 to see who has it.",
      "2. Call readDriverDispute on that driver to read the dispute.",
      "3. Call listAvailableDriversExcluding (zone 'SOMA', exclude the",
      "   disputing driver) to find a reroute candidate. Pick the CLOSEST",
      "   one by distanceMi.",
      "4. Call requestReassignApproval with orderId 'ord-9421', the",
      "   original driver id, the candidate driver id, and a one-sentence",
      "   rationale. This SUSPENDS the workflow until a human dispatcher",
      "   approves or rejects. Wait for the result — do not retry it.",
      "5. If approved, call refindDriver(ord-9421, from, to). If",
      "   rejected, call holdAssignment with extraEtaMin 15.",
      "6. Reply with a single sentence describing what you did and the new",
      "   ETA (or the hold).",
    ].join(" "),
    tools: {
      getCurrentAssignment: {
        description: "Look up which driver currently owns an order.",
        inputSchema: z.object({ orderId: z.string() }),
        execute: getCurrentAssignment,
      },
      readDriverDispute: {
        description: "Read the pending dispute a driver filed for their order.",
        inputSchema: z.object({ driverId: z.string() }),
        execute: readDriverDispute,
      },
      listAvailableDriversExcluding: {
        description:
          "List drivers in a zone, excluding one driver id (use this when finding a reroute candidate).",
        inputSchema: z.object({
          zone: z.string(),
          excludeDriverId: z.string(),
        }),
        execute: listAvailableDriversExcluding,
      },
      requestReassignApproval: {
        description:
          "Suspend the workflow and ask the human dispatcher to approve or reject a reassignment. Returns once the dispatcher decides.",
        inputSchema: z.object({
          orderId: z.string(),
          fromDriverId: z.string(),
          toDriverId: z.string(),
          rationale: z.string(),
        }),
        execute: requestReassignApproval,
      },
      refindDriver: {
        description:
          "Reassign an order from one driver to another. Must only be called after approval.",
        inputSchema: z.object({
          orderId: z.string(),
          fromDriverId: z.string(),
          toDriverId: z.string(),
        }),
        execute: refindDriver,
      },
      holdAssignment: {
        description:
          "Keep the original driver on the order and extend ETA by extraEtaMin minutes.",
        inputSchema: z.object({
          orderId: z.string(),
          extraEtaMin: z.number().int(),
        }),
        execute: holdAssignment,
      },
    },
  });

  const result = await agent.stream({
    messages: [
      {
        role: "user",
        content:
          "Mika's phone just filed a dispute for order ord-9421. Triage it.",
      },
    ],
    writable,
    collectUIMessages: true,
    maxSteps: 10,
  });

  return { messages: result.messages, uiMessages: result.uiMessages };
}
