import { DurableAgent } from "@workflow/ai/agent";
import { RetryableError, getStepMetadata, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Support · Retry
//
// Story: Elena Ruiz filed a complaint on order ord-8842 — her $18.75
// carne-asada burrito arrived 38 minutes late and cold. Our customer
// success DurableAgent triages the ticket, issues a $25 goodwill credit
// via Stripe, and sends an apology email.
//
// Twist: the Stripe credit endpoint rate-limits the first attempt
// (HTTP 429). Without the Workflow SDK this is the scariest kind of bug
// in customer support — was the credit issued or not? If the agent
// naively retries, Elena gets credited twice.
//
// With Workflow: the same step runs twice under the SAME stepId. The
// idempotency key baked into the step's identity guarantees Stripe
// dedupes the charge. The agent never knows the first call failed —
// the SDK hides the retry entirely.
// ---------------------------------------------------------------------------

const creditAttempts = new Map<string, number>();

// ---------------------------------------------------------------------------
// Step-backed tools
// ---------------------------------------------------------------------------

async function classifyComplaint({
  ticketId,
  body,
}: {
  ticketId: string;
  body: string;
}) {
  "use step";
  return {
    ticketId,
    category: "late-and-cold" as const,
    sentiment: "frustrated" as const,
    recommendedRemedy: "goodwill-credit" as const,
    excerpt: body.slice(0, 120),
  };
}

/**
 * Issues a goodwill credit to the customer's account via Stripe's
 * credit API. First attempt (per stepId) throws RetryableError to
 * simulate Stripe's 429 rate limit. On retry, the SAME stepId is
 * replayed — Stripe's idempotency key (derived from stepId) dedupes,
 * so Elena is credited exactly once.
 */
async function issueGoodwillCredit({
  customerId,
  orderId,
  amountUsd,
  reason,
}: {
  customerId: string;
  orderId: string;
  amountUsd: number;
  reason: string;
}) {
  "use step";

  const { stepId, attempt } = getStepMetadata();
  const prior = creditAttempts.get(stepId) ?? 0;
  creditAttempts.set(stepId, prior + 1);

  if (attempt === 1) {
    throw new RetryableError(
      `Stripe credit API 429 rate-limited for ${customerId} (ord ${orderId}) — idempotency key=${stepId} will retry`,
      { retryAfter: "900ms" },
    );
  }

  creditAttempts.delete(stepId);
  return {
    customerId,
    orderId,
    creditId: `cr_${stepId.slice(-8)}`,
    amountUsd,
    reason,
    attempt,
    idempotencyKey: stepId,
    provider: "stripe-credits",
    status: "issued" as const,
  };
}

async function sendApologyEmail({
  customerId,
  customerName,
  creditId,
  amountUsd,
}: {
  customerId: string;
  customerName: string;
  creditId: string;
  amountUsd: number;
}) {
  "use step";
  return {
    customerId,
    to: `${customerName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    subject: `Sorry about your order — $${amountUsd.toFixed(2)} on us`,
    creditId,
    status: "sent" as const,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function supportRetryAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Customer Success agent for a food-delivery platform.",
      "A complaint just came in from Elena Ruiz (customer cus_elena_3310) on",
      "order ord-8842 — her $18.75 carne-asada burrito from El Farolito",
      "arrived 38 minutes late and cold.",
      "Your job: (1) classify the complaint with classifyComplaint,",
      "(2) issue a $25 goodwill credit via issueGoodwillCredit,",
      "(3) send an apology email via sendApologyEmail using the returned creditId.",
      "Call each tool exactly once. After all three complete, reply with one",
      "short sentence confirming the credit was applied and the email was sent.",
      "Do not mention internal retries — the durability layer hides them.",
    ].join(" "),
    tools: {
      classifyComplaint: {
        description:
          "Triage the complaint into a category, sentiment, and recommended remedy.",
        inputSchema: z.object({
          ticketId: z.string(),
          body: z.string(),
        }),
        execute: classifyComplaint,
      },
      issueGoodwillCredit: {
        description:
          "Issue a goodwill credit to the customer's account via Stripe. Idempotent per stepId.",
        inputSchema: z.object({
          customerId: z.string(),
          orderId: z.string(),
          amountUsd: z.number(),
          reason: z.string(),
        }),
        execute: issueGoodwillCredit,
      },
      sendApologyEmail: {
        description: "Send an apology email referencing the credit.",
        inputSchema: z.object({
          customerId: z.string(),
          customerName: z.string(),
          creditId: z.string(),
          amountUsd: z.number(),
        }),
        execute: sendApologyEmail,
      },
    },
  });

  await agent.stream({
    messages: [
      {
        role: "user",
        content: [
          "Ticket tkt-4417 from Elena Ruiz (cus_elena_3310) on order ord-8842:",
          '"My burrito showed up 38 minutes late and ice cold. This is the',
          'second time this month. I want my money back."',
          "Resolve this with a $25 goodwill credit and an apology email.",
        ].join(" "),
      },
    ],
    writable,
    maxSteps: 8,
  });
}
