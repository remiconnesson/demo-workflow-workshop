import { FixSlideLayout } from "../_components/fix-slide-layout";
import { AGENT_GROUPS } from "../_data/agent-groups";

const group = AGENT_GROUPS["agent-first"];

const FIX_CODE = `async function fetchOrderDetails({ orderId }) {
  "use step"
  // step boundary — result is durable,
  // won't re-run on reconnect
  return db.orders.findOne({ orderId })
}

export async function supportAgent(messages) {
  "use workflow"

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: { fetchOrderDetails },
  })

  await agent.stream({ messages, writable })
}`;

export default function AgentFirstFixSlide() {
  return (
    <FixSlideLayout
      slide={group.slug}
      eyebrow={group.eyebrow}
      headline="An agent that survives F5."
      marker="span"
      filename="supportAgent.ts"
      statusTone="emerald"
      statusLabel="resumable stream"
      steps={[
        {
          label: "Mark tools as steps",
          detail: '"use step" makes each tool call durable',
        },
        {
          label: "Wrap the agent in a workflow",
          detail: '"use workflow" turns the whole loop into a run',
        },
        {
          label: "Client reconnects via run id",
          detail: "WorkflowChatTransport handles the rest",
        },
      ]}
      workflowFix={{ code: FIX_CODE }}
    />
  );
}
