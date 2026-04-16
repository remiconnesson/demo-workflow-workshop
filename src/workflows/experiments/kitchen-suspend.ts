import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

import { approvalHook } from "../_hooks";

// ---------------------------------------------------------------------------
// Kitchen coordinator — Suspend demo  (Chapter 2 of the kitchen story)
//
// Earlier (kitchen-retry), ticket tkt-8821 for Tartine Bakery printed to the
// expeditor after a transient flake. Now the pastry station pulls the tray
// and discovers the Morning Bun is 86'd — the last one just went out.
//
// The kitchen-coordinator DurableAgent:
//   1. checkSubstitutionOptions (step)   → finds Ham & Cheese Croissant
//   2. requestChefApproval       (hook)   → SUSPENDS on a durable hook until
//      the chef taps Approve / Reject in the UI
//   3. updateTicketItem           (step)   → rewrites the line on the ticket
//
// The hook token is deterministic (`kitchen-suspend:<ticketId>`) so the
// /approve route can resume without any extra bookkeeping.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Step-backed tools
// ---------------------------------------------------------------------------

async function checkSubstitutionOptions({
  ticketId,
  restaurant,
  outOfStockItem,
}: {
  ticketId: string;
  restaurant: string;
  outOfStockItem: string;
}) {
  "use step";
  return {
    ticketId,
    restaurant,
    outOfStockItem,
    reason: "86'd — last one sold two minutes ago",
    suggestedSubstitution: {
      name: "Ham & Cheese Croissant",
      priceDelta: 0.5,
      pastryStationReady: true,
    },
    alternatives: ["Almond Croissant", "Kouign-Amann"],
  };
}

async function updateTicketItem({
  ticketId,
  fromItem,
  toItem,
}: {
  ticketId: string;
  fromItem: string;
  toItem: string;
}) {
  "use step";
  return {
    ticketId,
    fromItem,
    toItem,
    reprintedAt: new Date().toISOString(),
    printer: "expeditor-01",
    status: "ticket_updated" as const,
  };
}

// ---------------------------------------------------------------------------
// Workflow-level tool: suspend on a hook until the chef approves
// ---------------------------------------------------------------------------

async function requestChefApproval({
  ticketId,
  proposedSubstitution,
}: {
  ticketId: string;
  proposedSubstitution: string;
}) {
  // No "use step" — hooks must be awaited at the workflow level.
  const token = `kitchen-suspend:${ticketId}`;
  const hook = approvalHook.create({ token });

  const decision = await hook;
  hook.dispose();

  return {
    ticketId,
    proposedSubstitution,
    approved: decision.approved,
    reason: decision.reason ?? null,
    token,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function kitchenSuspendAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Kitchen Coordinator agent for Tartine Bakery.",
      "Ticket tkt-8821 is on the pass (Morning Bun, Country Loaf, Hot",
      "Chocolate). The pastry station just flagged that the Morning Bun is",
      "86'd — there are no more. You must resolve this before the ticket",
      "ages out.",
      "Do these steps, in order:",
      "(1) call checkSubstitutionOptions for ticket tkt-8821, restaurant",
      "Tartine Bakery, outOfStockItem 'Morning Bun' to see what the pastry",
      "station can swap in,",
      "(2) call requestChefApproval with the suggested substitution — this",
      "SUSPENDS the run on a durable hook until the chef taps Approve or",
      "Reject on the KDS tablet,",
      "(3) if the chef approves, call updateTicketItem to rewrite the line",
      "from 'Morning Bun' to the approved substitution; if the chef rejects,",
      "do NOT call updateTicketItem.",
      "After the hook resumes, reply with ONE short sentence. If approved,",
      "confirm the swap and that the ticket is back in the kitchen. If",
      "rejected, note the guest will be offered a refund on that line.",
    ].join(" "),
    tools: {
      checkSubstitutionOptions: {
        description:
          "Ask the pastry station what can be swapped in for an 86'd item on a live ticket.",
        inputSchema: z.object({
          ticketId: z.string(),
          restaurant: z.string(),
          outOfStockItem: z.string(),
        }),
        execute: checkSubstitutionOptions,
      },
      requestChefApproval: {
        description:
          "Suspend the run and ask the chef to approve or reject the proposed substitution. The run will pause until the chef decides.",
        inputSchema: z.object({
          ticketId: z.string(),
          proposedSubstitution: z.string(),
        }),
        execute: requestChefApproval,
      },
      updateTicketItem: {
        description:
          "Rewrite a line item on a live ticket and reprint to the expeditor.",
        inputSchema: z.object({
          ticketId: z.string(),
          fromItem: z.string(),
          toItem: z.string(),
        }),
        execute: updateTicketItem,
      },
    },
  });

  await agent.stream({
    messages: [
      {
        role: "user",
        content:
          "Ticket tkt-8821 at Tartine Bakery: pastry station just 86'd the Morning Bun. Sort this out before the ticket ages.",
      },
    ],
    writable,
    maxSteps: 8,
  });
}
