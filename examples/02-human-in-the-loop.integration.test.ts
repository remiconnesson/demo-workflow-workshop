import { describe, it, expect } from "vitest";
import { start, resumeWebhook } from "workflow/api";
import { waitForHook, waitForSleep } from "@workflow/vitest";
import { placeOrder } from "./02-human-in-the-loop";

describe("placeOrder", () => {
  it("should dispatch when restaurant hits the webhook URL", async () => {
    const run = await start(placeOrder, ["order-1"]);

    // createWebhook generates a random token — pick up whichever hook is pending
    const hook = await waitForHook(run);
    await resumeWebhook(hook.token, new Request("http://test/accept"));

    const result = await run.returnValue;
    expect(result).toEqual({ orderId: "order-1", status: "dispatched" });
  });

  it("should throw when the 24h sleep wins the race", async () => {
    const run = await start(placeOrder, ["order-2"]);

    // Let the sleep fire instead of the webhook
    const sleepId = await waitForSleep(run);
    await run.wakeUp({ correlationIds: [sleepId] });

    await expect(run.returnValue).rejects.toThrow("Restaurant never accepted");
  });
});
