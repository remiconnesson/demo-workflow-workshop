import { describe, it, expect } from "vitest";
import { start } from "workflow/api";
import { orderWithRollbackWorkflow } from "./03-saga-rollback";

describe("orderWithRollbackWorkflow", () => {
  it("should complete when all steps succeed", async () => {
    const run = await start(orderWithRollbackWorkflow, [
      { orderId: "order-1", amount: 2500 },
    ]);
    const result = await run.returnValue;

    expect(result).toEqual({ orderId: "order-1", status: "completed" });
  });

  it("should roll back when a step fails", async () => {
    const run = await start(orderWithRollbackWorkflow, [
      { orderId: "order-2", amount: 2500, failAt: "assignDriver" },
    ]);
    const result = await run.returnValue;

    expect(result).toEqual({ orderId: "order-2", status: "rolled_back" });
  });
});
