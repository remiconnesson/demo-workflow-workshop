import { DurableAgent } from "@workflow/ai/agent";
import { getWritable, sleep } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// The pattern: an agent loop where every tool call is a durable step.
// If the server crashes mid-loop, the workflow resumes from the last
// completed step — no tool re-execution.

export async function fetchMetrics({ service }: { service: string }) {
  "use step";
  return { service, errorRate: 0.02, p99: 340, requestCount: 15420 };
}

export async function createAlert({
  message,
  severity,
}: {
  message: string;
  severity: string;
}) {
  "use step";
  return { alertId: `alert_${Date.now()}`, message, severity };
}

export async function monitorAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions:
      "You monitor service health. Fetch metrics each loop and create alerts for anomalies.",
    tools: {
      fetchMetrics: {
        description: "Fetch health metrics for a service.",
        inputSchema: z.object({ service: z.string() }),
        execute: fetchMetrics,
      },
      createAlert: {
        description: "Create an alert for an anomaly.",
        inputSchema: z.object({
          message: z.string(),
          severity: z.enum(["info", "warn", "critical"]),
        }),
        execute: createAlert,
      },
    },
  });

  for (let i = 0; i < 10; i++) {
    await agent.stream({
      messages: [
        {
          role: "user",
          content: `Loop ${i + 1}: check api-gateway and payments-service.`,
        },
      ],
      writable,
      maxSteps: 4,
    });

    await sleep("30s");
  }
}
