import { FixSlideLayout } from "../_components/fix-slide-layout";
import { AGENT_GROUPS } from "../_data/agent-groups";

const group = AGENT_GROUPS["agent-observer"];

const FIX_CODE = `async function fetchRecentOrders({ limit }) {
  "use step"
  return getRecentOrders(limit)
}

export async function observerAgentWorkflow() {
  "use workflow"

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: "Watch orders. Report anomalies.",
    tools: { fetchRecentOrders, analyzeWindow, appendToReport },
  })

  for (let i = 0; i < 20; i++) {
    await agent.stream({ messages, maxSteps: 6 })
    await sleep("30s")
  }
}`;

export default function AgentObserverFixSlide() {
  return (
    <FixSlideLayout
      slide={group.slug}
      eyebrow={group.eyebrow}
      headline="Same loop. Durable substrate."
      marker="span"
      filename="observerAgent.ts"
      statusTone="sky"
      statusLabel="autonomous loop"
      steps={[
        {
          label: "Mark fetches as steps",
          detail: "durable boundary around side effects",
        },
        {
          label: "Run the agent in a loop",
          detail: "same while-loop you'd write today",
        },
        {
          label: "Sleep between passes",
          detail: "durable sleep — no cron, no worker",
        },
      ]}
      workflowFix={{ code: FIX_CODE }}
    />
  );
}
