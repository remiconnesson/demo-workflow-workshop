import { describe, it, expect } from "vitest";

// DurableAgent workflows require ANTHROPIC_API_KEY for full integration tests.
// This file tests the step functions directly as unit tests.

describe("analyzeData step", () => {
  it("should return analysis results", async () => {
    const { analyzeData } = await import("./06-agent-human-approval");
    const result = await analyzeData({ query: "pricing anomalies" });

    expect(result.query).toBe("pricing anomalies");
    expect(result.finding).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });
});

describe("applyChange step", () => {
  it("should apply a change for the given proposal", async () => {
    const { applyChange } = await import("./06-agent-human-approval");
    const result = await applyChange({ proposalId: "prop-1" });

    expect(result).toEqual({ applied: true, proposalId: "prop-1" });
  });
});
