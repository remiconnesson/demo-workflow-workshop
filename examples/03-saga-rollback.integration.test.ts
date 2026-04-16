import { describe, it, expect } from "vitest";
import { start, resumeHook } from "workflow/api";
import { waitForSleep } from "@workflow/vitest";
import { orderWithRollbackWorkflow } from "./03-saga-rollback";

describe("orderWithRollbackWorkflow", () => {
  it("should complete cleanly when the 24h dispute window passes", async () => {
    const run = await start(orderWithRollbackWorkflow, [{ orderId: "order-1" }]);

    // Let the sleep win the race — no dispute filed
    const sleepId = await waitForSleep(run);
    await run.wakeUp({ correlationIds: [sleepId] });

    const result = await run.returnValue;
    expect(result).toEqual({ orderId: "order-1", status: "completed" });
  });

  it("should unwind in reverse when the dispute hook fires", async () => {
    const run = await start(orderWithRollbackWorkflow, [{ orderId: "order-2" }]);

    // Resolve the hook before the sleep — customer disputes delivery
    await resumeHook(`order:order-2:delivery-dispute`, {
      reason: "never arrived",
    });

    await expect(run.returnValue).rejects.toThrow("Disputed: never arrived");
  });
});
