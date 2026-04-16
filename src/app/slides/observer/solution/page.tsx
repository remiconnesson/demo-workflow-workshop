import { FixSlideLayout } from "../../_components/fix-slide-layout";
import { AGENT_GROUPS } from "../../_data/agent-groups";

const group = AGENT_GROUPS["agent-observer"];

const FIX_CODE = `async function fetchRecentOrders({ limit }) {
  "use step"
  return getRecentOrders(limit)
}

export async function observerAgentWorkflow() {
  "use workflow"

  const writable = getWritable()
  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: "Watch orders. Report anomalies.",
    tools: { fetchRecentOrders, analyzeWindow, appendToReport },
  })

  for (let i = 0; i < 20; i++) {
    await agent.stream({
      messages: [{ role: "user", content: \`Loop \${i + 1}: check recent orders.\` }],
      writable,
      maxSteps: 6,
    })
    await sleep("30s")
  }
}`;

export default function AgentObserverFixSlide() {
  return (
    <FixSlideLayout
      slide={group.slug}
      eyebrow={group.eyebrow}
      headline="Same loop. Durable foundation."
      marker="span"
      filename="observerAgent.ts"
      statusTone="sky"
      statusLabel="autonomous loop"
      steps={[
        {
          label: <>Mark fetches as <code className="font-mono">steps</code></>,
          detail: <><span className="text-zinc-300">&quot;use step&quot;</span> — durable boundary around side effects</>,
        },
        {
          label: <>Run the agent in a <code className="font-mono">loop</code></>,
          detail: <>same <span className="text-zinc-300">for</span> loop you&apos;d write today</>,
        },
        {
          label: <><code className="font-mono">Sleep</code> between passes</>,
          detail: <>durable <span className="text-zinc-300">sleep(&quot;30s&quot;)</span> — no cron, no worker</>,
        },
      ]}
      workflowFix={{ code: FIX_CODE }}
    />
  );
}
