// Human-in-the-Loop — suspend the workflow until an external system responds.
//
// Mirrors: /slides/suspend/solution

import { createWebhook, sleep } from "workflow";

export async function placeOrder(orderId: string) {
  "use workflow";

  // createWebhook suspends the workflow.
  // One URL. No route. No polling.
  using webhook = createWebhook();

  // Send the accept link to the restaurant
  await pingRestaurant(orderId, webhook.url);

  // Race: restaurant taps accept vs 24h timeout
  const accepted = await Promise.race([
    webhook.then(() => true),
    sleep("24h").then(() => false),
  ]);

  if (!accepted) {
    throw new Error("Restaurant never accepted");
  }

  await findDriver(orderId);
  return { orderId, status: "dispatched" as const };
}

export async function pingRestaurant(orderId: string, callbackUrl: string) {
  "use step";
  // In production:
  // await fetch(`https://restaurant-api.example.com/orders/${orderId}`, {
  //   method: "POST",
  //   body: JSON.stringify({ acceptUrl: callbackUrl }),
  // });
  return { notified: true, orderId, callbackUrl };
}

export async function findDriver(orderId: string) {
  "use step";
  // In production: call driver dispatch service
  return { assigned: true, orderId };
}
