// Idempotency pattern: use the stable stepId as an idempotency key
// so retries never duplicate side effects.

import { getStepMetadata } from "workflow";

export async function chargeOnceWorkflow(input: {
  orderId: string;
  amount: number;
}) {
  "use workflow";

  const paymentId = await chargePayment(input.orderId, input.amount);
  await sendReceipt(input.orderId, paymentId);

  return { orderId: input.orderId, paymentId };
}

// The key insight: stepId is stable across retries, making it
// safe to use as an idempotency key for external APIs.
//
//   const result = await stripe.charges.create(
//     { amount, currency: "usd" },
//     { idempotencyKey: stepId }
//   );
//
export async function chargePayment(
  orderId: string,
  amount: number,
): Promise<string> {
  "use step";
  const { stepId } = getStepMetadata();
  // In production, pass stepId as your idempotency key to Stripe/etc.
  return `pay_${stepId}`;
}

export async function sendReceipt(orderId: string, paymentId: string) {
  "use step";
  // In production, send an email here.
  return { orderId, paymentId, sent: true };
}
