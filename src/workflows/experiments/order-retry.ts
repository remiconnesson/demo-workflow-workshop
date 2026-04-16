import { DurableAgent } from "@workflow/ai/agent";
import { RetryableError, getStepMetadata, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Retry-tracking store (module scope) — same pattern as place-order.ts.
// Each stepId gets a counter so that retries of the SAME step share state
// across attempts. Throwing RetryableError replays the step with the same
// stepId but a bumped `attempt`.
// ---------------------------------------------------------------------------

const validateAttempts = new Map<string, number>();

// ---------------------------------------------------------------------------
// Step-backed tools
// ---------------------------------------------------------------------------

/**
 * Tool the agent calls to validate a delivery address via a "third-party
 * geocoder" (Smarty/Loqate-style). On attempt 1 for a given stepId it
 * throws RetryableError — the Workflow runtime durably re-invokes this
 * step with the same stepId on attempt 2, where we return success.
 *
 * This is the moment the demo hinges on: the agent's tool call does not
 * have to know about retries — the SDK replays the step and the agent
 * sees only the successful result.
 */
async function validateDeliveryAddress({
  orderId,
  address,
}: {
  orderId: string;
  address: string;
}) {
  "use step";

  const { stepId, attempt } = getStepMetadata();
  const prior = validateAttempts.get(stepId) ?? 0;
  validateAttempts.set(stepId, prior + 1);

  // First attempt for this stepId → flake.
  if (attempt === 1) {
    throw new RetryableError(
      `Geocoder 503 for ${address} (order ${orderId}) — retry scheduled`,
      { retryAfter: "800ms" },
    );
  }

  // Retry → success.
  validateAttempts.delete(stepId);
  return {
    orderId,
    address,
    normalized: address.replace(/\s+/g, " ").trim(),
    lat: 37.7751,
    lng: -122.4194,
    stepId,
    attempt,
    provider: "smarty-geocoder",
  };
}

async function chargeCustomer({
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
    paymentId: `pay_${stepId.slice(-6)}`,
    status: "captured" as const,
  };
}

async function pingRestaurant({
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
// Workflow
// ---------------------------------------------------------------------------

export async function orderRetryAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Order Lifecycle agent for a food-delivery platform.",
      "A customer just placed order ord-5621 from Burger Barn: one Classic Burger ($12.50).",
      "Delivery address: '1455 Market St, San Francisco'.",
      "Your job: (1) validate the delivery address using validateDeliveryAddress,",
      "(2) charge the customer via chargeCustomer for the exact amount,",
      "(3) notify the restaurant via pingRestaurant.",
      "Call each tool exactly once. After the three tools complete, reply with",
      "a single short sentence confirming the order is on its way. Do not",
      "mention any internal errors or retries in your final message — the",
      "durability layer hides transient failures from you.",
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
      chargeCustomer: {
        description: "Charge the customer's saved card for the order total.",
        inputSchema: z.object({
          orderId: z.string(),
          amount: z.number(),
        }),
        execute: chargeCustomer,
      },
      pingRestaurant: {
        description: "Send the order ticket to the restaurant's kitchen.",
        inputSchema: z.object({
          orderId: z.string(),
          restaurant: z.string(),
        }),
        execute: pingRestaurant,
      },
    },
  });

  await agent.stream({
    messages: [
      {
        role: "user",
        content:
          "Process order ord-5621 from Burger Barn: Classic Burger, $12.50, to 1455 Market St, San Francisco.",
      },
    ],
    writable,
    maxSteps: 8,
  });
}
