import { describe, it, expect } from "vitest";

// DurableAgent workflows call a real LLM, so full integration tests
// require ANTHROPIC_API_KEY. This file tests the step functions directly.
// For full agent integration tests, see the Workflow SDK testing docs.

// Import the exported step function for unit testing
// ("use step" is a no-op without the workflow compiler)

describe("lookupOrder step", () => {
  it("should return order details", async () => {
    // Import dynamically to avoid module resolution issues
    const { lookupOrder } = await import("./04-resumable-agent");
    const result = await lookupOrder({ orderId: "ord-123" });

    expect(result).toEqual({
      orderId: "ord-123",
      customer: "Jane Doe",
      total: 42.5,
      status: "delivered",
    });
  });
});
