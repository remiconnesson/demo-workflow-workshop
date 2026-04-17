import { DurableAgent } from "@workflow/ai/agent";
import { defineHook, getStepMetadata, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Support · Suspend  —  Chapter 2 of Elena's complaint story.
//
// Ten minutes after we issued Elena Ruiz a $25 goodwill credit on order
// ord-8842 (see support-retry), she replies to the apology email:
//
//   "A credit isn't enough — that burrito ruined dinner for my kid's
//    birthday. I want a full refund AND a comp meal. Otherwise I'm
//    posting screenshots."
//
// Our Customer Success DurableAgent re-opens ticket tkt-4417, drafts a
// $68 combined remedy (refund $18.75 + comp-meal voucher $50), and hits
// its policy ceiling: anything above the $50 agent cap requires a human
// supervisor's blessing. The agent SUSPENDS on a durable hook.
//
// While suspended the process can die, the server can redeploy, the
// box can reboot. When the supervisor answers the approval on their
// phone, the runtime rehydrates the agent's full message history and
// it resumes exactly where it paused.
// ---------------------------------------------------------------------------

export const supportSuspendHook = defineHook({
  schema: z.object({
    approved: z.boolean(),
    reason: z.string().optional(),
  }),
});

export type SupportSuspendPayload = { approved: boolean; reason?: string };

// ---------------------------------------------------------------------------
// Step-backed tools
// ---------------------------------------------------------------------------

async function reopenTicket({
  ticketId,
  reason,
}: {
  ticketId: string;
  reason: string;
}) {
  "use step";
  return {
    ticketId,
    status: "reopened" as const,
    prevResolution: "goodwill-credit-$25",
    escalationReason: reason,
    riskScore: 0.74,
  };
}

async function draftResolution({
  customerId,
  orderId,
  refundUsd,
  compMealUsd,
}: {
  customerId: string;
  orderId: string;
  refundUsd: number;
  compMealUsd: number;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  const total = refundUsd + compMealUsd;
  const policyCapUsd = 50;
  return {
    resolutionId: `res_${stepId.slice(-8)}`,
    customerId,
    orderId,
    refundUsd,
    compMealUsd,
    totalUsd: total,
    policyCapUsd,
    exceedsCap: total > policyCapUsd,
    overCapBy: Math.max(0, total - policyCapUsd),
  };
}

async function applyResolution({
  resolutionId,
  refundUsd,
  compMealUsd,
}: {
  resolutionId: string;
  refundUsd: number;
  compMealUsd: number;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    resolutionId,
    refundId: `rf_${stepId.slice(-8)}`,
    voucherCode: `COMP-${stepId.slice(-6).toUpperCase()}`,
    refundUsd,
    compMealUsd,
    status: "applied" as const,
    provider: "stripe+rewards",
  };
}

async function sendResolutionEmail({
  customerId,
  customerName,
  refundUsd,
  voucherCode,
}: {
  customerId: string;
  customerName: string;
  refundUsd: number;
  voucherCode: string;
}) {
  "use step";
  return {
    customerId,
    to: `${customerName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    subject: `Your refund and comp meal on us — thanks for your patience`,
    refundUsd,
    voucherCode,
    status: "sent" as const,
  };
}

// ---------------------------------------------------------------------------
// Workflow-level tool: SUSPEND on a hook until a supervisor answers.
// ---------------------------------------------------------------------------

async function requestSupervisorApproval({
  ticketId,
  resolutionId,
  totalUsd,
  overCapBy,
}: {
  ticketId: string;
  resolutionId: string;
  totalUsd: number;
  overCapBy: number;
}) {
  // Deterministic token — the UI derives it from the ticketId.
  const token = `support-suspend:${ticketId}`;
  const hook = supportSuspendHook.create({ token });
  const decision = await hook;
  hook.dispose();

  return {
    ticketId,
    resolutionId,
    totalUsd,
    overCapBy,
    approved: decision.approved,
    reason: decision.reason ?? null,
    token,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function supportSuspendAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Customer Success agent for a food-delivery platform.",
      "Elena Ruiz (customer cus_elena_3310) is escalating ticket tkt-4417",
      "on order ord-8842 ($18.75 burrito). Ten minutes ago you issued a",
      "$25 goodwill credit, but Elena replied demanding a full refund",
      "AND a comp meal — the burrito ruined her kid's birthday dinner.",
      "Your policy cap per agent action is $50. Anything above requires",
      "supervisor approval.",
      "Follow this exact procedure:",
      "(1) reopenTicket with ticketId tkt-4417 and a short escalation reason.",
      "(2) draftResolution with refundUsd=18.75 and compMealUsd=50 — that's",
      "    the $68.75 combined remedy Elena is asking for.",
      "(3) Because the draft exceeds the $50 policy cap, call",
      "    requestSupervisorApproval with the ticketId, resolutionId,",
      "    totalUsd, and overCapBy from the draft.",
      "(4) If approved, call applyResolution with the resolutionId and the",
      "    same refund/comp-meal amounts, then sendResolutionEmail to",
      "    Elena (customerName 'Elena Ruiz') using the voucherCode returned.",
      "(5) If rejected, do NOT apply anything — just acknowledge the",
      "    rejection in your reply.",
      "Call each tool at most once. End with ONE short sentence describing",
      "the outcome. Never mention hooks, suspension, or internal mechanics.",
    ].join(" "),
    tools: {
      reopenTicket: {
        description:
          "Re-open a previously resolved complaint ticket with an escalation reason.",
        inputSchema: z.object({
          ticketId: z.string(),
          reason: z.string(),
        }),
        execute: reopenTicket,
      },
      draftResolution: {
        description:
          "Draft a combined refund + comp-meal resolution and check it against the $50 agent policy cap.",
        inputSchema: z.object({
          customerId: z.string(),
          orderId: z.string(),
          refundUsd: z.number(),
          compMealUsd: z.number(),
        }),
        execute: draftResolution,
      },
      requestSupervisorApproval: {
        description:
          "Suspend the workflow and ask a human supervisor to approve this over-cap resolution.",
        inputSchema: z.object({
          ticketId: z.string(),
          resolutionId: z.string(),
          totalUsd: z.number(),
          overCapBy: z.number(),
        }),
        execute: requestSupervisorApproval,
      },
      applyResolution: {
        description:
          "Apply the approved resolution: issue the refund and mint the comp-meal voucher.",
        inputSchema: z.object({
          resolutionId: z.string(),
          refundUsd: z.number(),
          compMealUsd: z.number(),
        }),
        execute: applyResolution,
      },
      sendResolutionEmail: {
        description:
          "Email Elena confirming the refund and comp-meal voucher code.",
        inputSchema: z.object({
          customerId: z.string(),
          customerName: z.string(),
          refundUsd: z.number(),
          voucherCode: z.string(),
        }),
        execute: sendResolutionEmail,
      },
    },
  });

  await agent.stream({
    messages: [
      {
        role: "user",
        content: [
          "Elena Ruiz replied to ticket tkt-4417 (order ord-8842, cus_elena_3310):",
          '"A $25 credit is not enough. That burrito ruined my kid\'s birthday',
          "dinner. I want a full refund AND a comp meal or I'm posting",
          'screenshots." Handle the escalation.',
        ].join(" "),
      },
    ],
    writable,
    maxSteps: 10,
  });
}
