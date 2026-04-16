// Saga / Transactions & Rollbacks
// Push an undo for each side effect. On failure,
// the catch block pops compensations in reverse order.

type Compensation = { name: string; undo: () => Promise<void> };

export async function orderWithRollbackWorkflow(input: {
  orderId: string;
  amount: number;
  failAt?: string;
}) {
  "use workflow";

  const compensations: Compensation[] = [];

  try {
    const paymentId = await chargePayment(input.orderId, input.amount);
    compensations.push({
      name: "refundPayment",
      undo: () => refundPayment(input.orderId, paymentId),
    });

    await notifyRestaurant(input.orderId);
    compensations.push({
      name: "cancelOrder",
      undo: () => cancelRestaurantOrder(input.orderId),
    });

    const driverId = await assignDriver(input.orderId, input.failAt);
    compensations.push({
      name: "releaseDriver",
      undo: () => releaseDriver(input.orderId, driverId),
    });

    return { orderId: input.orderId, status: "completed" };
  } catch (error) {
    // Unwind in reverse order — each compensation is a durable step.
    while (compensations.length > 0) {
      const c = compensations.pop()!;
      await c.undo();
    }
    return { orderId: input.orderId, status: "rolled_back" };
  }
}

// Each step and compensation is independently durable.

export async function chargePayment(orderId: string, amount: number): Promise<string> {
  "use step";
  return `pay_${orderId}_${amount}`;
}

export async function refundPayment(orderId: string, paymentId: string) {
  "use step";
  return { refunded: true, orderId, paymentId };
}

export async function notifyRestaurant(orderId: string) {
  "use step";
  return { notified: true, orderId };
}

export async function cancelRestaurantOrder(orderId: string) {
  "use step";
  return { cancelled: true, orderId };
}

export async function assignDriver(orderId: string, failAt?: string): Promise<string> {
  "use step";
  if (failAt === "assignDriver") {
    throw new Error(`Driver assignment failed for ${orderId}`);
  }
  return `drv_${orderId}`;
}

export async function releaseDriver(orderId: string, driverId: string) {
  "use step";
  return { released: true, orderId, driverId };
}
