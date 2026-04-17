// Saga / Rollback — each successful step pushes its undo. A dispute hook
// races against a 24h sleep; if the customer disputes, the catch block
// unwinds every compensation in reverse order.
//
// Mirrors: /slides/rollback/solution

import { createHook, sleep } from "workflow";

export async function orderWithRollbackWorkflow(input: {
  orderId: string;
  disputeAt?: string;
}) {
  "use workflow";

  const rollbacks: Array<() => Promise<void>> = [];

  try {
    await reserveInventory(input.orderId);
    rollbacks.push(async () => {
      await releaseInventory(input.orderId);
    });

    await chargeCard(input.orderId);
    rollbacks.push(async () => {
      await refundPayment(input.orderId);
    });

    await pingRestaurant(input.orderId);
    rollbacks.push(async () => {
      await cancelRestaurantOrder(input.orderId);
    });

    // Open a post-delivery dispute window.
    const disputeHook = createHook<{ reason: string }>({
      token: `order:${input.orderId}:delivery-dispute`,
    });

    const verdict = await Promise.race([
      disputeHook.then((d) => ({ kind: "disputed" as const, ...d })),
      sleep("24h").then(() => ({ kind: "ok" as const })),
    ]);

    if (verdict.kind === "disputed") {
      // Workflow catch {} unwinds every compensation in reverse.
      throw new Error(`Disputed: ${verdict.reason}`);
    }

    return { orderId: input.orderId, status: "completed" as const };
  } catch (error) {
    // Unwind in reverse — each rollback is a "use step" so it's durable.
    for (const rollback of rollbacks.reverse()) {
      await rollback();
    }
    throw error;
  }
}

// Each step and compensation is independently durable.

export async function reserveInventory(orderId: string) {
  "use step";
  return { reserved: true, orderId };
}

export async function releaseInventory(orderId: string) {
  "use step";
  return { released: true, orderId };
}

export async function chargeCard(orderId: string) {
  "use step";
  return `pay_${orderId}`;
}

export async function refundPayment(orderId: string) {
  "use step";
  return { refunded: true, orderId };
}

export async function pingRestaurant(orderId: string) {
  "use step";
  return { notified: true, orderId };
}

export async function cancelRestaurantOrder(orderId: string) {
  "use step";
  return { cancelled: true, orderId };
}
