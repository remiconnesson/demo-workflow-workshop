import { DurableAgent } from "@workflow/ai/agent";
import { getWritable, sleep } from "workflow";
import { z } from "zod";
import {
  convertToModelMessages,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import {
  isGatewayFailure,
  runMockAgentTurn,
  shouldForceMockAgent,
} from "../_shared/mock-agent";

/**
 * "Our First Agent" — the zeroth demo of the Workflow SDK + Agents story.
 *
 * Goal: demonstrate that the chat stream is durable across page reloads
 * using WorkflowChatTransport. The agent runs one step-backed tool that
 * sleeps long enough (~3s) for the presenter to hit F5 mid-response and
 * watch the same sentence finish itself.
 */

async function fetchOrderDetails({ orderId }: { orderId: string }) {
  // No "use step" — this tool calls sleep(), which is a workflow-level
  // primitive. Per the canonical guidance, tools that use sleep()/hooks
  // run in the workflow context, not as steps. The slow tool still lets
  // the presenter hit F5 mid-response: the workflow VM resumes, sleep
  // picks up via the event log timer, and the LLM step's cached output
  // continues the same sentence on reconnect via WorkflowChatTransport.
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

  const runFallback = async () => {
    const orderId = "ord-8842";
    const details = await fetchOrderDetails({ orderId });
    await runMockAgentTurn({
      writable,
      script: {
        preludeText:
          "Thanks for reaching out — I'm pulling up your order now.",
        toolCalls: [
          {
            toolName: "fetchOrderDetails",
            toolCallId: "mock-first-agent-1",
            input: { orderId },
            output: details,
          },
        ],
        closingText: [
          `I found order ${details.orderId} for ${details.customer}:`,
          `one ${details.items[0].name} from ${details.restaurant} at`,
          `$${details.items[0].price.toFixed(2)}, delivered`,
          `at ${details.deliveredAt}. Let me know if you'd like a refund`,
          "or a follow-up.",
        ].join(" "),
      },
    });
  };

  if (shouldForceMockAgent()) {
    await runFallback();
    return;
  }

  try {
    await agent.stream({
      messages: await convertToModelMessages(messages),
      writable,
    });
  } catch (err) {
    if (!isGatewayFailure(err)) throw err;
    await runFallback();
  }
}
