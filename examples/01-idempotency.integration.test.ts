import { describe, it, expect } from "vitest";
import { start } from "workflow/api";
import { chargeOnceWorkflow } from "./01-idempotency";

describe("chargeOnceWorkflow", () => {
  it("should return orderId and a stable paymentId", async () => {
    const run = await start(chargeOnceWorkflow, [
      { orderId: "order-1", amount: 1999 },
    ]);
    const result = await run.returnValue;

    expect(result.orderId).toBe("order-1");
    expect(result.paymentId).toMatch(/^pay_/);
  });
});
