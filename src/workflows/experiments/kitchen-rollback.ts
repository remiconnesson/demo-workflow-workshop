import { DurableAgent } from "@workflow/ai/agent";
import { createHook, getWritable, sleep } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Kitchen coordinator — Rollback demo  (Chapter 3 of the kitchen story)
//
// Previously:
//   • ch.1 (kitchen-retry):   Ticket tkt-8821 printed to the expeditor at
//                             Tartine Bakery after a transient printer flake.
//   • ch.2 (kitchen-suspend): Morning Bun 86'd. Chef approved the swap to
//                             a Ham & Cheese Croissant. Prep began.
//
// Now: the guest pinged Tartine on the app — "allergy concern, please cancel
// before it leaves the pass." The kitchen-coordinator DurableAgent has
// already fired the ticket, reserved ingredients, and alerted the expeditor.
// When the cancel signal comes in, the agent MUST unwind — in REVERSE — every
// forward action it took. This is the canonical saga/compensation pattern
// from `place-order.ts`, applied to an agent loop.
//
// Forward tools (≥3, each "use step"):
//   1. fireKitchenStation        — station turns on, croissant starts
//   2. reserveSubstitutionStock  — pastry walk-in holds the croissant
//   3. alertExpeditor            — expo KDS lights up the ticket row
//
// Cancel trigger: durable hook `kitchen-rollback:<ticketId>`.
//   • UI "Cancel ticket" button POSTs to /api/experiments/kitchen-rollback/cancel
//   • Hook resumes with { cancel: true, reason }.
//   • If cancelled, the agent throws, which trips the try/catch and calls
//     the compensation stack in REVERSE order.
//
// Compensation tools (≥3, each "use step"), reverse unwind:
//   3'. standDownExpeditor       — clears the ticket from the KDS row
//   2'. releaseSubstitutionStock — returns the croissant to the walk-in
//   1'. killKitchenStation       — powers down the station mid-prep
//
// Then:
//   • voidTicket                 — ticket voided on the expeditor printer
//
// The agent personality is consistent with ch.1 + ch.2 — terse, kitchen-
// coordinator voice. The dramatic beat is the REVERSE UNWIND visible in
// the UI: the three green forward cards flip to fuchsia "COMPENSATED"
// pills from bottom to top.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Forward step-backed tools
// ---------------------------------------------------------------------------

async function fireKitchenStation({
  ticketId,
  station,
  item,
}: {
  ticketId: string;
  station: string;
  item: string;
}) {
  "use step";
  return {
    ticketId,
    station,
    item,
    firedAt: new Date().toISOString(),
    burnerId: `burner-${station}-02`,
    status: "fired" as const,
  };
}

async function reserveSubstitutionStock({
  ticketId,
  item,
  quantity,
}: {
  ticketId: string;
  item: string;
  quantity: number;
}) {
  "use step";
  return {
    ticketId,
    item,
    quantity,
    reservationId: `walkin-${ticketId}-${Date.now()}`,
    walkIn: "pastry-a",
    status: "reserved" as const,
  };
}

async function alertExpeditor({
  ticketId,
  pickupInMinutes,
}: {
  ticketId: string;
  pickupInMinutes: number;
}) {
  "use step";
  return {
    ticketId,
    pickupInMinutes,
    kdsRow: 3,
    expeditor: "expo-01",
    status: "lit" as const,
  };
}

// ---------------------------------------------------------------------------
// Compensation step-backed tools (reverse order in the unwind)
// ---------------------------------------------------------------------------

async function standDownExpeditor({
  ticketId,
  reservationId,
}: {
  ticketId: string;
  reservationId: string;
}) {
  "use step";
  return {
    ticketId,
    reservationId,
    kdsRow: 3,
    status: "ticket_cleared" as const,
    clearedAt: new Date().toISOString(),
  };
}

async function releaseSubstitutionStock({
  ticketId,
  reservationId,
}: {
  ticketId: string;
  reservationId: string;
}) {
  "use step";
  return {
    ticketId,
    reservationId,
    returnedTo: "pastry-a",
    status: "stock_returned" as const,
  };
}

async function killKitchenStation({
  ticketId,
  burnerId,
}: {
  ticketId: string;
  burnerId: string;
}) {
  "use step";
  return {
    ticketId,
    burnerId,
    status: "station_off" as const,
    killedAt: new Date().toISOString(),
  };
}

async function voidTicket({ ticketId }: { ticketId: string }) {
  "use step";
  return {
    ticketId,
    printer: "expeditor-01",
    status: "voided" as const,
    voidedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Workflow-level tool: wait on a cancel hook (short race against a sleep so
// the demo always resolves on stage even if the presenter never clicks).
// No "use step" — hooks must be awaited at the workflow level.
// ---------------------------------------------------------------------------

async function watchForCustomerCancel({
  ticketId,
}: {
  ticketId: string;
}) {
  const token = `kitchen-rollback:${ticketId}`;
  const hook = createHook<{ cancel: boolean; reason?: string }>({ token });

  const outcome = await Promise.race([
    hook.then((r) => ({ kind: "signal" as const, r })),
    // Safety valve for the live demo: if the presenter doesn't click the
    // cancel button, we still end the run cleanly after 90s. In production
    // this window would be the prep-to-pass SLA.
    sleep("90s").then(() => ({ kind: "timeout" as const })),
  ]);

  if (outcome.kind === "timeout") {
    return {
      ticketId,
      cancel: false as const,
      reason: "window_closed" as const,
      token,
    };
  }

  return {
    ticketId,
    cancel: outcome.r.cancel,
    reason: outcome.r.reason ?? null,
    token,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function kitchenRollbackAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Kitchen Coordinator agent for Tartine Bakery.",
      "Ticket tkt-8821 cleared the chef: Morning Bun was swapped for a",
      "Ham & Cheese Croissant. Prep must begin NOW.",
      "Phase 1 — FIRE (call each forward tool exactly once, in order):",
      "(1) fireKitchenStation with station 'pastry', item 'Ham & Cheese Croissant',",
      "(2) reserveSubstitutionStock with item 'Ham & Cheese Croissant', quantity 1,",
      "(3) alertExpeditor with pickupInMinutes 6.",
      "Phase 2 — WATCH: call watchForCustomerCancel for ticket tkt-8821. This",
      "SUSPENDS on a durable hook until the guest either hits cancel in the",
      "Tartine app or the window closes.",
      "Phase 3 — DECIDE:",
      "  • If watchForCustomerCancel returns cancel=false, the ticket is",
      "    safe to send. Reply with ONE short sentence: croissant plated,",
      "    ticket moving to the pass. Do not call any rollback tools.",
      "  • If watchForCustomerCancel returns cancel=true, you MUST roll back",
      "    IN REVERSE ORDER. Call the compensation tools in this exact",
      "    sequence — do NOT reorder, do NOT skip:",
      "      (a) standDownExpeditor  (undoes alertExpeditor)",
      "      (b) releaseSubstitutionStock  (undoes reserveSubstitutionStock)",
      "      (c) killKitchenStation  (undoes fireKitchenStation)",
      "      (d) voidTicket  (voids the ticket on the expeditor printer)",
      "    Pass reservationId and burnerId through from the earlier tool",
      "    outputs — do not invent values.",
      "    After the unwind, reply with ONE short sentence confirming the",
      "    ticket was rolled back cleanly and no food left the kitchen.",
      "Never mention tool names in the reply. The kitchen voice is terse.",
    ].join(" "),
    tools: {
      fireKitchenStation: {
        description:
          "Fire a station on the line — the burner turns on and prep begins for the item.",
        inputSchema: z.object({
          ticketId: z.string(),
          station: z.string(),
          item: z.string(),
        }),
        execute: fireKitchenStation,
      },
      reserveSubstitutionStock: {
        description:
          "Reserve the substitution item from the pastry walk-in so no one else pulls it.",
        inputSchema: z.object({
          ticketId: z.string(),
          item: z.string(),
          quantity: z.number(),
        }),
        execute: reserveSubstitutionStock,
      },
      alertExpeditor: {
        description:
          "Light up the ticket row on the expeditor KDS so expo knows to pick it up.",
        inputSchema: z.object({
          ticketId: z.string(),
          pickupInMinutes: z.number(),
        }),
        execute: alertExpeditor,
      },
      watchForCustomerCancel: {
        description:
          "Suspend the run on a durable hook. Returns when the guest sends a cancel signal from the Tartine app or the prep window closes.",
        inputSchema: z.object({
          ticketId: z.string(),
        }),
        execute: watchForCustomerCancel,
      },
      standDownExpeditor: {
        description:
          "Compensation for alertExpeditor — clears the ticket row from the expeditor KDS.",
        inputSchema: z.object({
          ticketId: z.string(),
          reservationId: z.string(),
        }),
        execute: standDownExpeditor,
      },
      releaseSubstitutionStock: {
        description:
          "Compensation for reserveSubstitutionStock — returns the held item to the pastry walk-in.",
        inputSchema: z.object({
          ticketId: z.string(),
          reservationId: z.string(),
        }),
        execute: releaseSubstitutionStock,
      },
      killKitchenStation: {
        description:
          "Compensation for fireKitchenStation — powers down the burner and halts prep.",
        inputSchema: z.object({
          ticketId: z.string(),
          burnerId: z.string(),
        }),
        execute: killKitchenStation,
      },
      voidTicket: {
        description:
          "Void the ticket on the expeditor printer. Run this last, after the rest of the unwind.",
        inputSchema: z.object({
          ticketId: z.string(),
        }),
        execute: voidTicket,
      },
    },
  });

  await agent.stream({
    messages: [
      {
        role: "user",
        content:
          "Ticket tkt-8821 at Tartine Bakery: chef approved the Ham & Cheese Croissant swap. Fire the station and reserve the croissant, then watch for a customer cancel. If the guest cancels, unwind everything in reverse.",
      },
    ],
    writable,
    maxSteps: 14,
  });
}
