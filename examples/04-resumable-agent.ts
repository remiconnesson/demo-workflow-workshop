import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import { z } from "zod";
import { convertToModelMessages, type UIMessage, type UIMessageChunk } from "ai";

// The pattern: DurableAgent + WorkflowChatTransport.
// The client stores the run ID and reconnects to the live stream on reload.

export async function lookupOrder({ orderId }: { orderId: string }) {
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

export async function supportAgentWorkflow(messages: UIMessage[]) {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: "You are a helpful support agent for a food delivery app.",
    tools: {
      lookupOrder: {
        description: "Look up order details by ID.",
        inputSchema: z.object({ orderId: z.string() }),
        execute: lookupOrder,
      },
    },
  });

  await agent.stream({
    messages: await convertToModelMessages(messages),
    writable,
  });
}
