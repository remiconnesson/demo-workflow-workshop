// Human-in-the-Loop — suspend the workflow until an external system responds.

import { createHook } from "workflow";

export async function orderWithApprovalWorkflow(input: { orderId: string }) {
  "use workflow";

  await notifyRestaurant(input.orderId);

  // Suspend here — the workflow sleeps until the restaurant POSTs to the hook URL.
  const hook = createHook<{ accepted: boolean }>({
    token: `restaurant-accept:${input.orderId}`,
  });
  const decision = await hook;

  if (!decision.accepted) {
    throw new Error("Restaurant rejected the order");
  }

  await assignDriver(input.orderId);
  return { orderId: input.orderId, status: "dispatched" };
}

export async function notifyRestaurant(orderId: string) {
  "use step";
  // In production:
  // await fetch(`https://restaurant-api.example.com/orders/${orderId}`, {
  //   method: "POST",
  // });
  return { notified: true, orderId };
}

export async function assignDriver(orderId: string) {
  "use step";
  // In production: call driver dispatch service
  return { assigned: true, orderId };
}
