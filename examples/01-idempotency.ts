// Idempotency pattern: use the stable stepId as an idempotency key
// so retries never duplicate side effects.
//
// Mirrors: /slides/retry/solution

import { getStepMetadata } from "workflow";

export async function chargeOnceWorkflow(order: {
  orderId: string;
  total: number;
}) {
  "use workflow";

  const paymentId = await chargeCard(order);
  return { orderId: order.orderId, paymentId };
}

// if this fails, it runs again
export async function chargeCard(order: {
  orderId: string;
  total: number;
}): Promise<string> {
  // "use step" marks the durable boundary...
  "use step";
  // ...and getStepMetadata hands you its identity
  const { stepId } = getStepMetadata();
  // lock it down with a stable id — in production:
  //   return stripe.charges.create(
  //     { amount: order.total },
  //     { idempotencyKey: stepId },
  //   )
  return `pay_${stepId}`;
}
