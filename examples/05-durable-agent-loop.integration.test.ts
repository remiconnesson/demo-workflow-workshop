import { describe, it, expect } from "vitest";

// DurableAgent workflows require ANTHROPIC_API_KEY for full integration tests.
// This file tests the step functions directly as unit tests.

describe("fetchRecentOrders step", () => {
  it("should return a list of recent orders", async () => {
    const { fetchRecentOrders } = await import("./05-durable-agent-loop");
    const result = await fetchRecentOrders({ limit: 3 });

    expect(result.orders).toHaveLength(3);
    expect(result.orders[0]).toMatchObject({ orderId: "ord_1" });
  });
});

describe("analyzeWindow step", () => {
  it("should surface anomalies from a window of order IDs", async () => {
    const { analyzeWindow } = await import("./05-durable-agent-loop");
    const result = await analyzeWindow({
      orderIds: ["a", "b", "c", "d", "e", "f", "g", "h"],
    });

    expect(Array.isArray(result.anomalies)).toBe(true);
  });
});

describe("appendToReport step", () => {
  it("should append a note", async () => {
    const { appendToReport } = await import("./05-durable-agent-loop");
    const result = await appendToReport({ note: "spike at 15:02" });

    expect(result).toEqual({ appended: true, note: "spike at 15:02" });
  });
});
