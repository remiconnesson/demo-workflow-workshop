import { DurableAgent } from "@workflow/ai/agent";
import { defineHook, getStepMetadata, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Chapter 2 of the order-retry story.
//
// Ord-5621 (Burger Barn, $12.50) already shipped at the end of the retry
// demo. A few minutes later, the SAME customer places a much larger
// follow-up order — ord-5627, $188.40 from Burger Barn, delivered to a
// freshly-entered address. Our fraud rules flag it for manual review.
//
// The agent validates + stages the charge, then SUSPENDS on a hook and
// waits for an ops operator to approve (or reject) before notifying the
// restaurant. The Workflow runtime keeps the durable state; the agent's
// message history is untouched when it resumes.
// ---------------------------------------------------------------------------

export const orderSuspendHook = defineHook({
  schema: z.object({
    approved: z.boolean(),
    reason: z.string().optional(),
  }),
});

export type OrderSuspendPayload = { approved: boolean; reason?: string };

// ---------------------------------------------------------------------------
// Step-backed tools
// ---------------------------------------------------------------------------

async function validateDeliveryAddress({
  orderId,
  address,
}: {
  orderId: string;
  address: string;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    orderId,
    address,
    normalized: address.replace(/\s+/g, " ").trim(),
    lat: 37.7935,
    lng: -122.3964,
    stepId,
    provider: "smarty-geocoder",
  };
}

async function screenForFraud({
  orderId,
  amount,
  customerId,
}: {
  orderId: string;
  amount: number;
  customerId: string;
}) {
  "use step";
  // Deterministic "flag" so the demo always suspends.
  return {
    orderId,
    customerId,
    amount,
    flagged: true as const,
    score: 0.82,
    reasons: [
      "amount_exceeds_customer_p95",
      "address_changed_within_10m",
      "second_order_within_session",
    ],
    provider: "sift-shield",
  };
}

async function stageCharge({
  orderId,
  amount,
}: {
  orderId: string;
  amount: number;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    orderId,
    amount,
    authId: `auth_${stepId.slice(-6)}`,
    status: "authorized_pending_review" as const,
  };
}

async function notifyRestaurant({
  orderId,
  restaurant,
}: {
  orderId: string;
  restaurant: string;
}) {
  "use step";
  return {
    orderId,
    restaurant,
    ticketId: `tkt_${orderId}`,
    status: "sent" as const,
  };
}

// ---------------------------------------------------------------------------
// Workflow-level tool: SUSPEND on a hook until the operator answers.
// ---------------------------------------------------------------------------

async function requestOperatorReview({
  orderId,
  amount,
  reasons,
}: {
  orderId: string;
  amount: number;
  reasons: string[];
}) {
  // Deterministic token so the UI can resume without scraping the stream.
  const token = `order-suspend:${orderId}`;
  const hook = orderSuspendHook.create({ token });
  const decision = await hook;
  hook.dispose();

  return {
    orderId,
    amount,
    reasons,
    approved: decision.approved,
    reason: decision.reason ?? null,
    token,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function orderSuspendAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Order Lifecycle agent for a food-delivery platform.",
      "This is a FOLLOW-UP order from the same customer you just processed (ord-5621).",
      "Order ord-5627 from Burger Barn: catering tray of 12 Classic Burgers plus sides, $188.40.",
      "Customer cust-8821, delivery address '600 Embarcadero, San Francisco' (changed 7 minutes ago).",
      "Your exact procedure:",
      "(1) validateDeliveryAddress for the new address,",
      "(2) screenForFraud with the order amount and customer id,",
      "(3) stageCharge to authorize (not capture) the amount,",
      "(4) because fraud screening flags this order, call requestOperatorReview with the order id,",
      "    amount, and the list of reasons returned by screenForFraud.",
      "(5) ONLY if the operator approves, call notifyRestaurant. If rejected, do not notify —",
      "    simply acknowledge the rejection in your reply.",
      "Call each tool exactly once. After the flow completes, reply with ONE short sentence",
      "describing the outcome. Never mention suspension, hooks, or internal mechanics.",
    ].join(" "),
    tools: {
      validateDeliveryAddress: {
        description:
          "Validate and geocode a delivery address via the third-party geocoder.",
        inputSchema: z.object({
          orderId: z.string(),
          address: z.string(),
        }),
        execute: validateDeliveryAddress,
      },
      screenForFraud: {
        description:
          "Run the order through the fraud-screening provider. Returns a flagged boolean and reason codes.",
        inputSchema: z.object({
          orderId: z.string(),
          amount: z.number(),
          customerId: z.string(),
        }),
        execute: screenForFraud,
      },
      stageCharge: {
        description:
          "Authorize (but do not capture) the customer's card for the order total.",
        inputSchema: z.object({
          orderId: z.string(),
          amount: z.number(),
        }),
        execute: stageCharge,
      },
      requestOperatorReview: {
        description:
          "Suspend the workflow and ask the human operator to approve or reject this flagged order.",
        inputSchema: z.object({
          orderId: z.string(),
          amount: z.number(),
          reasons: z.array(z.string()),
        }),
        execute: requestOperatorReview,
      },
      notifyRestaurant: {
        description: "Send the order ticket to the restaurant's kitchen.",
        inputSchema: z.object({
          orderId: z.string(),
          restaurant: z.string(),
        }),
        execute: notifyRestaurant,
      },
    },
  });

  await agent.stream({
    messages: [
      {
        role: "user",
        content:
          "Process follow-up order ord-5627 from Burger Barn: catering tray, $188.40, customer cust-8821, deliver to 600 Embarcadero, San Francisco.",
      },
    ],
    writable,
    maxSteps: 10,
  });
}
