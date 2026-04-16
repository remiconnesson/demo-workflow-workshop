import { DurableAgent } from "@workflow/ai/agent";
import { defineHook, getStepMetadata, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Chapter 3 of the order story: ROLLBACK.
//
// The catering tray from chapter 2 (ord-5627, $188.40 from Burger Barn,
// cust-8821, delivered to 600 Embarcadero) was approved by the operator and
// is now in motion. This agent finalizes the outbound leg — it captures the
// authorized charge, dispatches a driver, and pings the customer with an ETA.
//
// Then it awaits an in-flight status check. If the kitchen reports a severe
// peanut-allergen contamination on the tray, the agent MUST unwind every
// side effect in REVERSE order by calling the matching compensation tools:
// retractCustomerETA → releaseDriver → refundCustomer → voidRestaurantTicket.
// The compensation is the agent's work, not a framework rollback — the SDK
// just makes sure each compensation is durable.
// ---------------------------------------------------------------------------

export const orderRollbackHook = defineHook({
  schema: z.object({
    allergenAlert: z.boolean(),
    reason: z.string().optional(),
  }),
});

export type OrderRollbackPayload = {
  allergenAlert: boolean;
  reason?: string;
};

// ---------------------------------------------------------------------------
// Forward step-backed tools — each mutates state the agent will later need
// to undo.
// ---------------------------------------------------------------------------

async function capturePayment({
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
    provider: "stripe",
  };
}

async function dispatchDriver({
  orderId,
  pickupRestaurant,
}: {
  orderId: string;
  pickupRestaurant: string;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    orderId,
    pickupRestaurant,
    driverId: "drv-3312",
    driverName: "Priya K.",
    dispatchId: `dsp_${stepId.slice(-6)}`,
    etaMinutes: 22,
    status: "en_route" as const,
  };
}

async function sendCustomerETA({
  orderId,
  customerId,
  etaMinutes,
}: {
  orderId: string;
  customerId: string;
  etaMinutes: number;
}) {
  "use step";
  return {
    orderId,
    customerId,
    etaMinutes,
    channel: "push+sms" as const,
    notificationId: `ntf_${orderId}`,
    status: "delivered" as const,
  };
}

// ---------------------------------------------------------------------------
// Compensation step-backed tools — each undoes exactly one forward action.
// The agent is instructed to call these in REVERSE order.
// ---------------------------------------------------------------------------

async function retractCustomerETA({
  orderId,
  customerId,
  reason,
}: {
  orderId: string;
  customerId: string;
  reason: string;
}) {
  "use step";
  return {
    orderId,
    customerId,
    reason,
    channel: "push+sms" as const,
    notificationId: `ntf_retract_${orderId}`,
    status: "retracted" as const,
  };
}

async function releaseDriver({
  orderId,
  dispatchId,
  reason,
}: {
  orderId: string;
  dispatchId: string;
  reason: string;
}) {
  "use step";
  return {
    orderId,
    dispatchId,
    driverId: "drv-3312",
    reason,
    status: "recalled" as const,
  };
}

async function refundCustomer({
  orderId,
  paymentId,
  amount,
}: {
  orderId: string;
  paymentId: string;
  amount: number;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    orderId,
    paymentId,
    amount,
    refundId: `rfn_${stepId.slice(-6)}`,
    status: "refunded" as const,
    provider: "stripe",
  };
}

async function voidRestaurantTicket({
  orderId,
  restaurant,
  reason,
}: {
  orderId: string;
  restaurant: string;
  reason: string;
}) {
  "use step";
  return {
    orderId,
    restaurant,
    reason,
    ticketId: `tkt_${orderId}`,
    status: "voided" as const,
  };
}

// ---------------------------------------------------------------------------
// Workflow-level tool: SUSPEND awaiting the in-flight status check. The UI
// posts to /api/experiments/order-rollback/alert to resume with either an
// allergen alert (triggers rollback) or an all-clear.
// ---------------------------------------------------------------------------

async function awaitInFlightCheck({ orderId }: { orderId: string }) {
  const token = `order-rollback:${orderId}`;
  const hook = orderRollbackHook.create({ token });
  const signal = await hook;
  hook.dispose();

  return {
    orderId,
    allergenAlert: signal.allergenAlert,
    reason: signal.reason ?? null,
    token,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function orderRollbackAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Order Lifecycle agent for a food-delivery platform.",
      "This is the FINAL chapter of order ord-5627 from Burger Barn: catering tray,",
      "$188.40, customer cust-8821, delivery address '600 Embarcadero, San Francisco'.",
      "The operator already approved this flagged order; the authorization is live",
      "and the kitchen ticket has been accepted. Your job is to finalize dispatch",
      "and then monitor for a post-prep safety check.",
      "",
      "FORWARD STEPS (call each exactly once, in this order):",
      "(1) capturePayment — capture the $188.40 authorization.",
      "(2) dispatchDriver — send a driver to Burger Barn; remember the returned",
      "    dispatchId and etaMinutes.",
      "(3) sendCustomerETA — notify cust-8821 with the etaMinutes from step 2.",
      "(4) awaitInFlightCheck with the order id — the kitchen runs a final allergen",
      "    inspection while the tray is en route.",
      "",
      "BRANCHING ON THE CHECK:",
      "- If awaitInFlightCheck returns allergenAlert=false, the tray is clean. Reply",
      "  with ONE short sentence confirming delivery is on track and stop.",
      "- If allergenAlert=true, a severe peanut contamination was discovered. You",
      "  MUST unwind every prior side effect by calling the compensations in the",
      "  EXACT REVERSE order of the forward steps:",
      "    (a) retractCustomerETA (undoes step 3)",
      "    (b) releaseDriver with the dispatchId from step 2 (undoes step 2)",
      "    (c) refundCustomer with the paymentId from step 1 and amount 188.40",
      "        (undoes step 1)",
      "    (d) voidRestaurantTicket for Burger Barn (closes out the kitchen ticket)",
      "  After the unwind completes, reply with ONE short sentence confirming the",
      "  order was fully reversed and the customer is safe. Do not mention internal",
      "  mechanics, hooks, or compensation tooling in your reply.",
      "",
      "Call each tool at most once. Never skip a compensation once a rollback is",
      "triggered — every forward mutation has exactly one matching reversal.",
    ].join("\n"),
    tools: {
      capturePayment: {
        description:
          "Capture the previously authorized charge on the customer's card.",
        inputSchema: z.object({
          orderId: z.string(),
          amount: z.number(),
        }),
        execute: capturePayment,
      },
      dispatchDriver: {
        description:
          "Dispatch a delivery driver to the pickup restaurant. Returns dispatchId and etaMinutes.",
        inputSchema: z.object({
          orderId: z.string(),
          pickupRestaurant: z.string(),
        }),
        execute: dispatchDriver,
      },
      sendCustomerETA: {
        description:
          "Notify the customer (push + SMS) that their order is en route with the given ETA.",
        inputSchema: z.object({
          orderId: z.string(),
          customerId: z.string(),
          etaMinutes: z.number(),
        }),
        execute: sendCustomerETA,
      },
      awaitInFlightCheck: {
        description:
          "Suspend until the kitchen's in-flight allergen inspection reports back. Returns allergenAlert boolean.",
        inputSchema: z.object({ orderId: z.string() }),
        execute: awaitInFlightCheck,
      },
      retractCustomerETA: {
        description:
          "Compensation for sendCustomerETA — push a retraction notice to the customer.",
        inputSchema: z.object({
          orderId: z.string(),
          customerId: z.string(),
          reason: z.string(),
        }),
        execute: retractCustomerETA,
      },
      releaseDriver: {
        description:
          "Compensation for dispatchDriver — recall the driver and free them for other jobs.",
        inputSchema: z.object({
          orderId: z.string(),
          dispatchId: z.string(),
          reason: z.string(),
        }),
        execute: releaseDriver,
      },
      refundCustomer: {
        description:
          "Compensation for capturePayment — issue a full refund for the previously captured charge.",
        inputSchema: z.object({
          orderId: z.string(),
          paymentId: z.string(),
          amount: z.number(),
        }),
        execute: refundCustomer,
      },
      voidRestaurantTicket: {
        description:
          "Close out the restaurant kitchen ticket after a safety rollback.",
        inputSchema: z.object({
          orderId: z.string(),
          restaurant: z.string(),
          reason: z.string(),
        }),
        execute: voidRestaurantTicket,
      },
    },
  });

  await agent.stream({
    messages: [
      {
        role: "user",
        content:
          "Finalize ord-5627 for cust-8821: capture the $188.40 authorization, dispatch a driver from Burger Barn, send the customer an ETA, and then wait for the kitchen's in-flight allergen check before closing out the order.",
      },
    ],
    writable,
    maxSteps: 14,
  });
}
