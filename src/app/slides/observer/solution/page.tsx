import { FixSlideLayout } from "../../_components/fix-slide-layout";
import { AGENT_GROUPS } from "../../_data/agent-groups";

const group = AGENT_GROUPS["agent-observer"];

export default function AgentObserverFixSlide() {
  return (
    <FixSlideLayout
      slide={group.slug}
      eyebrow={group.eyebrow}
      headline="Same loop. Durable foundation."
      marker="span"
      filename="observerAgent.ts"
      statusTone="sky"
      statusLabel="retry · replay"
      steps={[
        {
          label: <>Mark the fetch <code className="font-mono">&quot;use step&quot;</code></>,
          detail: <>replay returns the <span className="text-zinc-300">cached</span> result</>,
        },
        {
          label: <>Run the agent in a <code className="font-mono">loop</code></>,
          detail: <>a plain <span className="text-zinc-300">while (true)</span> that the SDK makes durable</>,
        },
      ]}
      workflowFix={{
        progression: [
          {
            code: `async function fetchRecentOrders({ limit }) {
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

  // one-shot: runs once, no replay of prior calls
  await agent.stream({
    messages: [{ role: "user", content: "Check recent orders." }],
    writable,
  })
}`,
          },
          {
            highlightLines: {
              3: "Makes this fetch [durable](https://workflow-sdk.dev/docs/foundations/workflows-and-steps). On replay, returns the **cached result** instead of re-executing",
            },
            code: `async function fetchRecentOrders({ limit }) {
  // on retry, replays from log (no db hit)
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

  await agent.stream({
    messages: [{ role: "user", content: "Check recent orders." }],
    writable,
  })
}`,
          },
          {
            highlightLines: {
              17: "Always running. The SDK makes this [durable](https://workflow-sdk.dev/docs/foundations/workflows-and-steps), not a framework abstraction",
              18: "",
              19: "",
              20: "",
              21: "",
            },
            code: `async function fetchRecentOrders({ limit }) {
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

  // always running. survives crashes, resumes mid-iteration
  while (true) {
    await agent.stream({
      messages: [{ role: "user", content: "Check recent orders." }],
      writable,
      maxSteps: 6,
    })
  }
}`,
          },
        ],
      }}
    />
  );
}
