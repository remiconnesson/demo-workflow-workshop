import { describe, it, expect } from "vitest";

// DurableAgent workflows require ANTHROPIC_API_KEY for full integration tests.
// This file tests the step functions directly as unit tests.

describe("queryOrders step", () => {
  it("should return a sample for the window", async () => {
    const { queryOrders } = await import("./06-agent-human-approval");
    const result = await queryOrders({ window: "last-7-days" });

    expect(result.window).toBe("last-7-days");
    expect(result.sampleSize).toBeGreaterThan(0);
    expect(result.topMissingItem).toBeDefined();
  });
});

describe("proposeMenuChange step", () => {
  it("should draft a proposal with a stable id", async () => {
    const { proposeMenuChange } = await import("./06-agent-human-approval");
    const result = await proposeMenuChange({ item: "truffle-fries" });

    expect(result.proposalId).toMatch(/^prop_/);
    expect(result.item).toBe("truffle-fries");
    expect(result.action).toBe("add");
  });
});

describe("applyMenuChange step", () => {
  it("should apply an approved proposal", async () => {
    const { applyMenuChange } = await import("./06-agent-human-approval");
    const result = await applyMenuChange({ proposalId: "prop_x" });

    expect(result).toEqual({ applied: true, proposalId: "prop_x" });
  });
});

describe("rollbackMenuChange step", () => {
  it("should rollback a rejected proposal", async () => {
    const { rollbackMenuChange } = await import("./06-agent-human-approval");
    const result = await rollbackMenuChange({ proposalId: "prop_y" });

    expect(result).toEqual({ rolledBack: true, proposalId: "prop_y" });
  });
});
