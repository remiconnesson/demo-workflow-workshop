import { DurableAgent } from "@workflow/ai/agent";
import { getWritable, sleep } from "workflow";
import { z } from "zod";
import {
  convertToModelMessages,
  type UIMessage,
  type UIMessageChunk,
} from "ai";

/**
 * "Our First Agent" — the zeroth demo of the Workflow SDK + Agents story.
 *
 * Goal: demonstrate that the chat stream is durable across page reloads
 * using WorkflowChatTransport. The agent runs one step-backed tool that
 * sleeps long enough (~3s) for the presenter to hit F5 mid-response and
 * watch the same sentence finish itself.
 */

async function fetchOrderDetails({ orderId }: { orderId: string }) {
  "use step";
  // Slow the tool enough that a presenter can reload the page while it
  // runs. The step boundary is what makes the result durable — when the
  // client reconnects via WorkflowChatTransport, this value is already
  // in the event log, so the agent never re-runs the side effect.
  await sleep("3s");
  return {
    orderId,
    customer: "Elena Ruiz",
    restaurant: "Burger Barn",
    items: [{ name: "Chicken Burrito", price: 18.75 }],
    total: 18.75,
    placedAt: "7:42 PM",
    deliveredAt: "8:21 PM",
    deliveryNote: "Left at front door per customer preference.",
  } as const;
}

export async function ourFirstAgentWorkflow(messages: UIMessage[]) {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are a warm, efficient customer-support agent for a food-delivery app.",
      "When a customer opens a ticket, briefly acknowledge their issue in one sentence,",
      "then call fetchOrderDetails with the orderId they mention (or ord-8842 if they don't mention one).",
      "After the tool returns, respond with a concise resolution in under four sentences —",
      "cite the order number, the item, and the dollar amount.",
      "Keep the tone human, not scripted.",
    ].join(" "),
    tools: {
      fetchOrderDetails: {
        description:
          "Look up an order by ID. Returns customer, restaurant, items, total, and delivery info.",
        inputSchema: z.object({
          orderId: z.string(),
        }),
        execute: fetchOrderDetails,
      },
    },
  });

  await agent.stream({
    messages: await convertToModelMessages(messages),
    writable,
  });
}
