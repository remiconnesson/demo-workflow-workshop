import { describe, it, expect } from "vitest";

// DurableAgent workflows call a real LLM, so full integration tests
// require ANTHROPIC_API_KEY. This file tests the step functions directly.

describe("fetchOrderDetails step", () => {
  it("should return order details", async () => {
    const { fetchOrderDetails } = await import("./04-resumable-agent");
    const result = await fetchOrderDetails({ orderId: "ord-123" });

    expect(result).toEqual({
      orderId: "ord-123",
      customer: "Jane Doe",
      total: 42.5,
      status: "delivered",
    });
  });
});
