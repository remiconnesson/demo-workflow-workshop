// Observer agent: an autonomous loop that watches orders for anomalies.
// Every tool call is a durable step; sleep survives restarts.
//
// Mirrors: /slides/observer/solution

import { DurableAgent } from "@workflow/ai/agent";
import { getWritable, sleep } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

export async function fetchRecentOrders({ limit }: { limit: number }) {
  "use step";
  return {
    orders: Array.from({ length: limit }, (_, i) => ({
      orderId: `ord_${i + 1}`,
      total: 20 + i * 3,
    })),
  };
}

export async function analyzeWindow({ orderIds }: { orderIds: string[] }) {
  "use step";
  return { anomalies: orderIds.filter((_, i) => i % 7 === 0) };
}

export async function appendToReport({ note }: { note: string }) {
  "use step";
  return { appended: true, note };
}

export async function observerAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();
  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: "Watch orders. Report anomalies.",
    tools: {
      fetchRecentOrders: {
        description: "Fetch the most recent orders.",
        inputSchema: z.object({ limit: z.number() }),
        execute: fetchRecentOrders,
      },
      analyzeWindow: {
        description: "Analyze a window of order IDs for anomalies.",
        inputSchema: z.object({ orderIds: z.array(z.string()) }),
        execute: analyzeWindow,
      },
      appendToReport: {
        description: "Append a note to the running report.",
        inputSchema: z.object({ note: z.string() }),
        execute: appendToReport,
      },
    },
  });

  for (let i = 0; i < 20; i++) {
    await agent.stream({
      messages: [
        { role: "user", content: `Loop ${i + 1}: check recent orders.` },
      ],
      writable,
      maxSteps: 6,
    });
    await sleep("30s");
  }
}
