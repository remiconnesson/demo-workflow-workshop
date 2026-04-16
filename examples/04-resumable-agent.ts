// Resumable agent — a DurableAgent whose stream survives F5.
// The client stores the run ID and reconnects via WorkflowChatTransport.
//
// Mirrors: /slides/first-agent/solution

import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import { z } from "zod";
import { convertToModelMessages, type UIMessage, type UIMessageChunk } from "ai";

export async function fetchOrderDetails({ orderId }: { orderId: string }) {
  "use step";
  // Step boundary makes this result durable — on reconnect,
  // the SDK replays from the event log without re-executing.
  return {
    orderId,
    customer: "Jane Doe",
    total: 42.5,
    status: "delivered",
  };
}

export async function supportAgent(messages: UIMessage[]) {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: {
      fetchOrderDetails: {
        description: "Fetch order details by ID.",
        inputSchema: z.object({ orderId: z.string() }),
        execute: fetchOrderDetails,
      },
    },
  });

  await agent.stream({
    messages: await convertToModelMessages(messages),
    writable,
  });
}
