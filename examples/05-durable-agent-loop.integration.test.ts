import { describe, it, expect } from "vitest";

// DurableAgent workflows require ANTHROPIC_API_KEY for full integration tests.
// This file tests the step functions directly as unit tests.

describe("fetchMetrics step", () => {
  it("should return metrics for a service", async () => {
    const { fetchMetrics } = await import("./05-durable-agent-loop");
    const result = await fetchMetrics({ service: "api-gateway" });

    expect(result.service).toBe("api-gateway");
    expect(result.errorRate).toBe(0.02);
    expect(result.p99).toBe(340);
    expect(result.requestCount).toBe(15420);
  });
});

describe("createAlert step", () => {
  it("should create an alert with the given parameters", async () => {
    const { createAlert } = await import("./05-durable-agent-loop");
    const result = await createAlert({
      message: "High error rate",
      severity: "critical",
    });

    expect(result.alertId).toMatch(/^alert_/);
    expect(result.message).toBe("High error rate");
    expect(result.severity).toBe("critical");
  });
});
