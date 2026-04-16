import { DurableAgent } from "@workflow/ai/agent";
import { RetryableError, getStepMetadata, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Kitchen coordinator — Retry demo
//
// Story: A dine-in ticket for Tartine Bakery drops on its first hop through
// the kitchen printer (printer went offline briefly). The kitchen-coordinator
// DurableAgent calls `sendTicketToPrinter` to fire the ticket to the
// expeditor printer. The FIRST attempt per stepId throws RetryableError —
// the Workflow runtime replays the step under the same stepId with
// `attempt === 2`, where we succeed. The agent never has to know.
//
// The agent also checks prep capacity and confirms the fire-time. Only the
// printer tool flakes — that's the demo moment.
// ---------------------------------------------------------------------------

// Module-level retry tracker — same pattern as place-order.ts and
// order-retry.ts. Keyed by stepId so replayed steps share state.
const printerAttempts = new Map<string, number>();

// ---------------------------------------------------------------------------
// Step-backed tools
// ---------------------------------------------------------------------------

async function checkPrepCapacity({
  restaurant,
}: {
  restaurant: string;
}) {
  "use step";
  return {
    restaurant,
    ticketsInQueue: 4,
    avgPrepMinutes: 11,
    expeditorOnline: true,
    capacityOk: true as const,
  };
}

/**
 * The flaky tool. On attempt 1 we throw RetryableError — the Workflow
 * runtime durably reschedules the step under the same stepId. On
 * attempt 2 we return success. This is what the UI highlights.
 */
async function sendTicketToPrinter({
  ticketId,
  restaurant,
  items,
}: {
  ticketId: string;
  restaurant: string;
  items: string[];
}) {
  "use step";

  const { stepId, attempt } = getStepMetadata();
  const prior = printerAttempts.get(stepId) ?? 0;
  printerAttempts.set(stepId, prior + 1);

  if (attempt === 1) {
    throw new RetryableError(
      `Expeditor printer offline (ticket ${ticketId}, ${restaurant}) — retry scheduled`,
      { retryAfter: "900ms" },
    );
  }

  printerAttempts.delete(stepId);
  return {
    ticketId,
    restaurant,
    items,
    printedAt: new Date().toISOString(),
    printer: "expeditor-01",
    stepId,
    attempt,
    status: "printed" as const,
  };
}

async function confirmFireTime({
  ticketId,
  fireInMinutes,
}: {
  ticketId: string;
  fireInMinutes: number;
}) {
  "use step";
  return {
    ticketId,
    fireInMinutes,
    confirmedBy: "kds-expo",
    status: "confirmed" as const,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function kitchenRetryAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Kitchen Coordinator agent for Tartine Bakery.",
      "A new dine-in ticket just arrived: ticket tkt-8821, one Morning Bun,",
      "one Country Loaf, one Hot Chocolate.",
      "Your job, in order:",
      "(1) call checkPrepCapacity for Tartine Bakery to confirm the kitchen",
      "is caught up,",
      "(2) call sendTicketToPrinter to fire the ticket to the expeditor printer,",
      "(3) call confirmFireTime with a 6-minute fire delay so the pastry",
      "station can pull the buns hot.",
      "Call each tool exactly once. After all three succeed, reply with ONE",
      "short sentence confirming the ticket is in the kitchen. Do not mention",
      "any printer errors — the Workflow runtime absorbs transient failures",
      "and replays the step durably.",
    ].join(" "),
    tools: {
      checkPrepCapacity: {
        description:
          "Check the restaurant's current prep queue depth and expeditor status.",
        inputSchema: z.object({
          restaurant: z.string(),
        }),
        execute: checkPrepCapacity,
      },
      sendTicketToPrinter: {
        description:
          "Fire the ticket to the expeditor printer at the restaurant's pass.",
        inputSchema: z.object({
          ticketId: z.string(),
          restaurant: z.string(),
          items: z.array(z.string()),
        }),
        execute: sendTicketToPrinter,
      },
      confirmFireTime: {
        description:
          "Confirm with the expo station when to fire the ticket (minutes from now).",
        inputSchema: z.object({
          ticketId: z.string(),
          fireInMinutes: z.number(),
        }),
        execute: confirmFireTime,
      },
    },
  });

  await agent.stream({
    messages: [
      {
        role: "user",
        content:
          "New dine-in ticket tkt-8821 for Tartine Bakery: Morning Bun, Country Loaf, Hot Chocolate. Get it to the kitchen.",
      },
    ],
    writable,
    maxSteps: 8,
  });
}
