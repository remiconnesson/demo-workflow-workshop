import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const OBSERVER_PATH = path.resolve(
  __dirname,
  "../../src/workflows/observer-agent.ts",
);

describe("observer-agent hook token determinism", () => {
  const source = fs.readFileSync(OBSERVER_PATH, "utf8");

  it("must not use Date.now() for hook tokens", () => {
    const tokenLines = source
      .split("\n")
      .filter((l) => l.includes("observer-flag:") || l.includes("token"));

    const usesDateNow = tokenLines.some((l) => l.includes("Date.now()"));
    expect(usesDateNow, "hook token must not depend on Date.now()").toBe(false);
  });

  it("must not use Math.random() for hook tokens", () => {
    const tokenLines = source
      .split("\n")
      .filter((l) => l.includes("observer-flag:") || l.includes("token"));

    const usesRandom = tokenLines.some((l) => l.includes("Math.random()"));
    expect(usesRandom, "hook token must not depend on Math.random()").toBe(
      false,
    );
  });

  it("token pattern should be deterministic (counter-based)", () => {
    const tokenAssignment = source
      .split("\n")
      .find((l) => l.includes("observer-flag:"));

    expect(tokenAssignment).toBeDefined();
    expect(
      tokenAssignment,
      "token should use a counter variable, not Date.now()/Math.random()",
    ).toMatch(/observer-flag:.*\$\{.*(?:count|index|flag)/i);
  });
});
