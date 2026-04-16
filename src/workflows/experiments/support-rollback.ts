import { DurableAgent } from "@workflow/ai/agent";
import { defineHook, getStepMetadata, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Support · Rollback  —  Chapter 3 of Elena Ruiz's complaint story.
//
// Twelve minutes after the supervisor approved Elena's $68.75 over-cap
// remedy (see support-suspend), our fraud-signals pipeline lights up on
// ticket tkt-4417:
//
//   - 3rd complaint from cus_elena_3310 this calendar month
//   - the card on file for ord-8842 was added 4 hours before the order
//   - the delivery address on ord-8842 doesn't match the billing ZIP
//
// The Customer Success DurableAgent re-opens the case in DEFENSIVE mode:
// it REVERSES the supervisor-approved remedy step by step — void the
// comp voucher, claw back the Stripe refund, retract the apology email,
// flag the account for fraud review, post a note to the risk queue.
//
// Each forward step pushes a compensation onto a saga stack. While the
// agent is mid-unwind, the Risk team pipes up on the hook:
//
//   "False positive — new card was Elena's husband's, address is her
//    in-laws (kid's birthday party). Reverse the reversal."
//
// The workflow throws, catches, and pops compensations in REVERSE order:
// scrub the risk note → clear the fraud flag → resend the apology →
// re-issue the refund → re-mint the voucher. Elena ends the chapter
// exactly where Chapter 2 left her — whole, apologized-to, and
// $68.75 richer — and the agent's message history survived a full
// forward + reverse unwind without losing a single stepId.
// ---------------------------------------------------------------------------

export const supportRollbackHook = defineHook({
  schema: z.object({
    verdict: z.enum(["fraud-confirmed", "false-positive"]),
    reason: z.string().optional(),
  }),
});

export type SupportRollbackPayload = {
  verdict: "fraud-confirmed" | "false-positive";
  reason?: string;
};

// ---------------------------------------------------------------------------
// Forward "defensive" step-backed tools. Each one undoes something
// Chapter 2 put in place.
// ---------------------------------------------------------------------------

async function classifyFraudSignals({
  ticketId,
  customerId,
  orderId,
}: {
  ticketId: string;
  customerId: string;
  orderId: string;
}) {
  "use step";
  return {
    ticketId,
    customerId,
    orderId,
    signals: [
      { code: "repeat-complainer", detail: "3rd complaint this month" },
      { code: "new-card", detail: "card added 4h before ord-8842" },
      { code: "address-mismatch", detail: "billing ZIP ≠ delivery ZIP" },
    ],
    riskScore: 0.82,
    recommendedAction: "reverse-remedy" as const,
  };
}

async function voidCompVoucher({
  voucherCode,
  customerId,
}: {
  voucherCode: string;
  customerId: string;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    voucherCode,
    customerId,
    voidId: `void_${stepId.slice(-8)}`,
    status: "voided" as const,
    provider: "rewards",
  };
}

async function reverseRefund({
  refundId,
  customerId,
  amountUsd,
}: {
  refundId: string;
  customerId: string;
  amountUsd: number;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    refundId,
    customerId,
    clawbackId: `cb_${stepId.slice(-8)}`,
    amountUsd,
    status: "reversed" as const,
    provider: "stripe-refunds",
  };
}

async function retractApologyEmail({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  "use step";
  return {
    customerId,
    to: `${customerName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    subject: "Update on your recent ticket — under review",
    status: "retracted" as const,
    replacesPrior: "apology-email",
  };
}

async function flagAccountForFraud({
  customerId,
  riskScore,
}: {
  customerId: string;
  riskScore: number;
}) {
  "use step";
  return {
    customerId,
    flagId: `flag_${customerId.slice(-6)}`,
    riskScore,
    status: "flagged" as const,
    queue: "risk-review",
  };
}

async function postRiskNote({
  ticketId,
  customerId,
  note,
}: {
  ticketId: string;
  customerId: string;
  note: string;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    ticketId,
    customerId,
    noteId: `note_${stepId.slice(-8)}`,
    note,
    status: "posted" as const,
  };
}

// ---------------------------------------------------------------------------
// Compensation step-backed tools — each reverses ONE forward tool.
// ---------------------------------------------------------------------------

async function scrubRiskNote({ noteId }: { noteId: string }) {
  "use step";
  return { noteId, status: "scrubbed" as const };
}

async function clearFraudFlag({
  customerId,
  flagId,
}: {
  customerId: string;
  flagId: string;
}) {
  "use step";
  return { customerId, flagId, status: "cleared" as const };
}

async function resendApologyEmail({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  "use step";
  return {
    customerId,
    to: `${customerName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    subject: "Apologies for the whiplash — your remedy is back in place",
    status: "sent" as const,
  };
}

async function reissueRefund({
  customerId,
  amountUsd,
}: {
  customerId: string;
  amountUsd: number;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    customerId,
    refundId: `rf_${stepId.slice(-8)}`,
    amountUsd,
    status: "reissued" as const,
    provider: "stripe-refunds",
  };
}

async function remintCompVoucher({
  customerId,
  amountUsd,
}: {
  customerId: string;
  amountUsd: number;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    customerId,
    voucherCode: `COMP-${stepId.slice(-6).toUpperCase()}`,
    amountUsd,
    status: "reminted" as const,
  };
}

// ---------------------------------------------------------------------------
// Workflow-level tool: await the Risk team verdict on the hook.
// Resolves with either "fraud-confirmed" (keep the unwound state) or
// "false-positive" (trigger rollback via a thrown sentinel).
// ---------------------------------------------------------------------------

class RollbackRequested extends Error {
  constructor(public reason: string) {
    super(`rollback_requested:${reason}`);
  }
}

async function awaitRiskVerdict({ ticketId }: { ticketId: string }) {
  const token = `support-rollback:${ticketId}`;
  const hook = supportRollbackHook.create({ token });
  const decision = await hook;
  hook.dispose();
  return {
    ticketId,
    verdict: decision.verdict,
    reason: decision.reason ?? null,
    token,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

type Compensation = {
  action:
    | "scrubRiskNote"
    | "clearFraudFlag"
    | "resendApologyEmail"
    | "reissueRefund"
    | "remintCompVoucher";
  label: string;
  undo: () => Promise<unknown>;
};

export async function supportRollbackAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  // Saga compensation stack — lives at workflow scope so both the agent's
  // forward tools (via closure) and the catch block can see it. Each
  // defensive tool records its inverse here; on rollback we pop in reverse.
  const compensations: Compensation[] = [];

  // We cache a few identifiers from Chapter 2 so the compensations can
  // refer to the right refund / voucher / flag by id.
  let capturedNoteId: string | null = null;
  let capturedFlagId: string | null = null;
  let capturedCustomerName: string | null = null;

  // Capture the hook verdict out of the agent's tool path so the outer
  // workflow can decide whether to throw after the agent returns.
  let riskVerdict: "fraud-confirmed" | "false-positive" | null = null;

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Customer Success agent for a food-delivery platform, now",
      "operating in DEFENSIVE mode. Ticket tkt-4417 (Elena Ruiz,",
      "cus_elena_3310, order ord-8842) was resolved in Chapter 2 with a",
      "supervisor-approved $68.75 remedy: refund rf_tkt4417 ($18.75) +",
      "comp-meal voucher COMP-TKT417 ($50). Our fraud pipeline just lit up",
      "on this account — reverse the remedy, defensively, then wait for the",
      "Risk team's verdict.",
      "Follow this exact procedure, calling each tool at most once:",
      "(1) classifyFraudSignals with ticketId tkt-4417, customerId",
      "    cus_elena_3310, orderId ord-8842.",
      "(2) voidCompVoucher with voucherCode 'COMP-TKT417' and the customerId.",
      "(3) reverseRefund with refundId 'rf_tkt4417', customerId, amountUsd 18.75.",
      "(4) retractApologyEmail with customerId and customerName 'Elena Ruiz'.",
      "(5) flagAccountForFraud with the customerId and the riskScore from",
      "    classifyFraudSignals.",
      "(6) postRiskNote with ticketId, customerId, and a short one-line note",
      "    summarising the three fraud signals.",
      "(7) awaitRiskVerdict with ticketId tkt-4417. This SUSPENDS the agent",
      "    until the Risk team answers.",
      "After the verdict, reply with ONE short sentence. If verdict is",
      "'fraud-confirmed', confirm the account is locked. If 'false-positive',",
      "acknowledge the reversal will be undone. Never mention saga stacks,",
      "hooks, or rollback mechanics.",
    ].join(" "),
    tools: {
      classifyFraudSignals: {
        description:
          "Score the ticket against the fraud-signals pipeline and recommend an action.",
        inputSchema: z.object({
          ticketId: z.string(),
          customerId: z.string(),
          orderId: z.string(),
        }),
        execute: classifyFraudSignals,
      },
      voidCompVoucher: {
        description:
          "Void the comp-meal voucher issued in the prior resolution.",
        inputSchema: z.object({
          voucherCode: z.string(),
          customerId: z.string(),
        }),
        execute: async (args) => {
          const out = await voidCompVoucher(args);
          capturedCustomerName = capturedCustomerName ?? "Elena Ruiz";
          compensations.push({
            action: "remintCompVoucher",
            label: "Re-mint comp voucher",
            undo: () =>
              remintCompVoucher({
                customerId: args.customerId,
                amountUsd: 50,
              }),
          });
          return out;
        },
      },
      reverseRefund: {
        description:
          "Reverse the Stripe refund issued by the prior resolution (clawback).",
        inputSchema: z.object({
          refundId: z.string(),
          customerId: z.string(),
          amountUsd: z.number(),
        }),
        execute: async (args) => {
          const out = await reverseRefund(args);
          compensations.push({
            action: "reissueRefund",
            label: "Re-issue refund",
            undo: () =>
              reissueRefund({
                customerId: args.customerId,
                amountUsd: args.amountUsd,
              }),
          });
          return out;
        },
      },
      retractApologyEmail: {
        description:
          "Send Elena a neutral 'under review' email that retracts the prior apology.",
        inputSchema: z.object({
          customerId: z.string(),
          customerName: z.string(),
        }),
        execute: async (args) => {
          const out = await retractApologyEmail(args);
          capturedCustomerName = args.customerName;
          compensations.push({
            action: "resendApologyEmail",
            label: "Resend apology email",
            undo: () =>
              resendApologyEmail({
                customerId: args.customerId,
                customerName: args.customerName,
              }),
          });
          return out;
        },
      },
      flagAccountForFraud: {
        description: "Flag the customer account for the risk-review queue.",
        inputSchema: z.object({
          customerId: z.string(),
          riskScore: z.number(),
        }),
        execute: async (args) => {
          const out = await flagAccountForFraud(args);
          capturedFlagId = out.flagId;
          compensations.push({
            action: "clearFraudFlag",
            label: "Clear fraud flag",
            undo: () =>
              clearFraudFlag({
                customerId: args.customerId,
                flagId: out.flagId,
              }),
          });
          return out;
        },
      },
      postRiskNote: {
        description:
          "Post a one-line note to the risk-review queue summarising the signals.",
        inputSchema: z.object({
          ticketId: z.string(),
          customerId: z.string(),
          note: z.string(),
        }),
        execute: async (args) => {
          const out = await postRiskNote(args);
          capturedNoteId = out.noteId;
          compensations.push({
            action: "scrubRiskNote",
            label: "Scrub risk note",
            undo: () => scrubRiskNote({ noteId: out.noteId }),
          });
          return out;
        },
      },
      awaitRiskVerdict: {
        description:
          "Suspend the workflow until the Risk team returns a verdict on the flag.",
        inputSchema: z.object({ ticketId: z.string() }),
        execute: async (args) => {
          const out = await awaitRiskVerdict(args);
          riskVerdict = out.verdict;
          return out;
        },
      },
    },
  });

  try {
    await agent.stream({
      messages: [
        {
          role: "user",
          content: [
            "Fraud pipeline flagged ticket tkt-4417 (Elena Ruiz,",
            "cus_elena_3310, order ord-8842) at 14:22 UTC, twelve minutes",
            "after the supervisor-approved $68.75 remedy was applied.",
            "Reverse the remedy defensively, then wait for the Risk team.",
          ].join(" "),
        },
      ],
      writable,
      maxSteps: 12,
    });

    // Agent reply has streamed. If the verdict was false-positive, throw
    // a sentinel so the catch block unwinds the saga stack in reverse.
    if (riskVerdict === "false-positive") {
      throw new RollbackRequested(
        "Risk team cleared Elena — reversing the reversal",
      );
    }

    // fraud-confirmed: everything stays reversed. Emit a final summary
    // chunk so the UI can distinguish this terminal state.
    await emitRollbackEvent(
      { type: "terminal", outcome: "fraud-confirmed" },
      compensations.map((c) => c.action),
      capturedNoteId,
      capturedFlagId,
      capturedCustomerName,
    );
    return {
      outcome: "fraud-confirmed" as const,
      compensationsApplied: [] as Compensation["action"][],
    };
  } catch (error) {
    if (!(error instanceof RollbackRequested)) {
      // Unexpected error: unwind what we can, then rethrow so it surfaces
      // in the run's terminal error.
      await unwind(compensations);
      throw error;
    }

    const executed = await unwind(compensations);

    await emitRollbackEvent(
      { type: "terminal", outcome: "false-positive" },
      executed,
      capturedNoteId,
      capturedFlagId,
      capturedCustomerName,
    );

    return {
      outcome: "false-positive" as const,
      compensationsApplied: executed,
    };
  }
}

async function unwind(
  compensations: Compensation[],
): Promise<Compensation["action"][]> {
  const executed: Compensation["action"][] = [];
  while (compensations.length > 0) {
    const c = compensations.pop()!;
    await emitRollbackEvent({
      type: "compensating",
      action: c.action,
      label: c.label,
    });
    await c.undo();
    await emitRollbackEvent({
      type: "compensated",
      action: c.action,
      label: c.label,
    });
    executed.push(c.action);
  }
  return executed;
}

// The agent streams UIMessageChunk events to the writable. We piggy-back
// compensation events onto the same stream as `data-rollback` chunks so
// the page can distinguish them from tool lifecycle events without
// fighting the agent's chunk schema.
type RollbackEvent =
  | { type: "compensating"; action: Compensation["action"]; label: string }
  | { type: "compensated"; action: Compensation["action"]; label: string }
  | {
      type: "terminal";
      outcome: "fraud-confirmed" | "false-positive";
    };

async function emitRollbackEvent(
  event: RollbackEvent,
  ..._ctx: unknown[]
): Promise<void> {
  "use step";
  // The writable is a UIMessageChunk stream. We emit a `data-rollback`
  // part which the ai-sdk surfaces as `type: "data-rollback"` with the
  // payload under `data`. The page filters these separately from the
  // agent's tool chunks.
  const writer = getWritable<UIMessageChunk>().getWriter();
  try {
    await writer.write({
      type: "data-rollback",
      data: event,
    } as unknown as UIMessageChunk);
  } finally {
    writer.releaseLock();
  }
}
