import { describe, it, expect } from "vitest";
import { start, resumeHook } from "workflow/api";
import { waitForHook } from "@workflow/vitest";
import { orderWithApprovalWorkflow } from "./02-human-in-the-loop";

describe("orderWithApprovalWorkflow", () => {
  it("should dispatch when restaurant accepts", async () => {
    const run = await start(orderWithApprovalWorkflow, [{ orderId: "order-1" }]);

    await waitForHook(run, { token: "restaurant-accept:order-1" });
    await resumeHook("restaurant-accept:order-1", { accepted: true });

    const result = await run.returnValue;
    expect(result).toEqual({ orderId: "order-1", status: "dispatched" });
  });

  it("should throw when restaurant rejects", async () => {
    const run = await start(orderWithApprovalWorkflow, [{ orderId: "order-2" }]);

    await waitForHook(run, { token: "restaurant-accept:order-2" });
    await resumeHook("restaurant-accept:order-2", { accepted: false });

    await expect(run.returnValue).rejects.toThrow("Restaurant rejected the order");
  });
});
