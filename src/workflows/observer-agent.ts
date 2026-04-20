import { DurableAgent } from "@workflow/ai/agent";
import { getWritable, sleep } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

import {
  appendReport,
  getRecentOrders,
  type OrderRecord,
  type ReportEntry,
} from "@/lib/ops-data";
import { approvalHook } from "./_hooks";
import {
  isGatewayFailure,
  runMockAgentTurn,
  shouldForceMockAgent,
} from "./_shared/mock-agent";

// ---------------------------------------------------------------------------
// Step-backed tools
// ---------------------------------------------------------------------------

async function fetchRecentOrders({ limit }: { limit: number }) {
  "use step";
  return getRecentOrders(limit);
}

async function analyzeWindow({ orders }: { orders: OrderRecord[] }) {
  "use step";

  const SLOW_MS = 7000;
  const RETRY_THRESHOLD = 2;

  const total = orders.length;
  const slowWaits = orders.filter((o) => o.waitMs >= SLOW_MS).length;
  const highRetries = orders.filter((o) => o.retries >= RETRY_THRESHOLD).length;
  const compensations = orders.reduce((sum, o) => sum + o.compensationsFired, 0);
  const cancelled = orders.filter((o) => o.outcome === "cancelled").length;
  const refunded = orders.filter((o) => o.outcome === "refunded").length;

  const byScenario: Record<string, number> = {};
  for (const o of orders) {
    byScenario[o.scenario] = (byScenario[o.scenario] ?? 0) + 1;
  }

  // Restaurant with the worst wait average
  const byRestaurant = new Map<string, { total: number; count: number }>();
  for (const o of orders) {
    const r = byRestaurant.get(o.restaurantId) ?? { total: 0, count: 0 };
    r.total += o.waitMs;
    r.count += 1;
    byRestaurant.set(o.restaurantId, r);
  }
  let worstRestaurant: { id: string; avgMs: number } | null = null;
  for (const [id, { total: t, count }] of byRestaurant.entries()) {
    const avg = t / count;
    if (!worstRestaurant || avg > worstRestaurant.avgMs) {
      worstRestaurant = { id, avgMs: Math.round(avg) };
    }
  }

  return {
    total,
    slowWaits,
    highRetries,
    compensations,
    cancelled,
    refunded,
    byScenario,
    worstRestaurant,
  };
}

async function appendToReport({ entries }: { entries: ReportEntry[] }) {
  "use step";
  const stamped = entries.map((e) => appendReport(e));
  return { appended: stamped.length };
}

// ---------------------------------------------------------------------------
// Workflow-level tool: human ack via hook (factory, closure captures counter)
// ---------------------------------------------------------------------------

function makeFlagForHuman() {
  let flagCallCount = 0;

  return async function flagForHuman({
    summary,
    severity,
  }: {
    summary: string;
    severity: "info" | "warn" | "critical";
  }) {
    // No "use step" here; hooks must be awaited at the workflow level.
    const token = `observer-flag:${++flagCallCount}`;
    const hook = approvalHook.create({ token });

    const ack = await hook;
    hook.dispose();

    return {
      acknowledged: ack.approved,
      reason: ack.reason ?? null,
      severity,
      summary,
      token,
    };
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function observerAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();
  const flagForHuman = makeFlagForHuman();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are an autonomous ops observer for a food-delivery platform.",
      "On each loop, fetch recent orders, analyze them for anomalies",
      "(slow waits over 7s, retries >= 2, compensations, cancellations),",
      "and append concise report entries via appendToReport.",
      "If you see a critical anomaly (e.g. repeated cancellations at one",
      "restaurant), call flagForHuman to request acknowledgement.",
      "Keep report entries short (one sentence) and quantitative.",
    ].join(" "),
    tools: {
      fetchRecentOrders: {
        description: "Read the most recent order records from ops storage.",
        inputSchema: z.object({ limit: z.number().int().min(1).max(100) }),
        execute: fetchRecentOrders,
      },
      analyzeWindow: {
        description: "Count anomalies in a window of order records.",
        inputSchema: z.object({
          orders: z.array(z.any()),
        }),
        execute: analyzeWindow,
      },
      appendToReport: {
        description: "Append one or more entries to the durable report.",
        inputSchema: z.object({
          entries: z.array(
            z.object({
              at: z.string(),
              kind: z.enum(["metric", "flag", "summary"]),
              text: z.string(),
              data: z.record(z.string(), z.any()).optional(),
            }),
          ),
        }),
        execute: appendToReport,
      },
      flagForHuman: {
        description:
          "Pause the agent and request human acknowledgement of a critical anomaly.",
        inputSchema: z.object({
          summary: z.string(),
          severity: z.enum(["info", "warn", "critical"]),
        }),
        execute: flagForHuman,
      },
    },
  });

  const runLoopFallback = async (loopIndex: number) => {
    const orders = await fetchRecentOrders({ limit: 25 });
    const window = await analyzeWindow({ orders });
    const summary = [
      `Loop ${loopIndex + 1}: scanned ${window.total} orders,`,
      `${window.slowWaits} slow waits, ${window.highRetries} retry-heavy,`,
      `${window.compensations} compensations.`,
    ].join(" ");
    await appendToReport({
      entries: [
        {
          at: new Date().toISOString(),
          kind: "summary",
          text: summary,
        },
      ],
    });
    await runMockAgentTurn({
      idPrefix: `mock-observer-${loopIndex}`,
      script: {
        preludeText: `Loop ${loopIndex + 1}: starting scan.`,
        toolCalls: [
          {
            toolName: "fetchRecentOrders",
            toolCallId: `mock-observer-fetch-${loopIndex}`,
            input: { limit: 25 },
            output: orders,
          },
          {
            toolName: "analyzeWindow",
            toolCallId: `mock-observer-analyze-${loopIndex}`,
            input: { orders },
            output: window,
          },
          {
            toolName: "appendToReport",
            toolCallId: `mock-observer-append-${loopIndex}`,
            input: {
              entries: [
                {
                  at: new Date().toISOString(),
                  kind: "summary",
                  text: summary,
                },
              ],
            },
            output: { appended: 1 },
          },
        ],
        closingText: summary,
      },
    });
  };

  const MAX_LOOPS = 20;
  for (let i = 0; i < MAX_LOOPS; i++) {
    if (shouldForceMockAgent()) {
      await runLoopFallback(i);
    } else {
      try {
        await agent.stream({
          messages: [
            {
              role: "user",
              content: [
                `Loop ${i + 1} of ${MAX_LOOPS}.`,
                "Fetch the last 25 orders, analyze them, and append 1-3 short",
                "report entries covering any notable metrics or flags.",
                "Only call flagForHuman if severity is critical.",
              ].join(" "),
            },
          ],
          writable,
          maxSteps: 6,
        });
      } catch (err) {
        if (!isGatewayFailure(err)) throw err;
        await runLoopFallback(i);
      }
    }

    await sleep("30s");
  }
}
