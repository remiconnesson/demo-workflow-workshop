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
          detail: <>on replay, the result is <span className="text-zinc-300">cached</span>, not refetched</>,
        },
        {
          label: <>Run the agent in a <code className="font-mono">loop</code></>,
          detail: <>a plain <span className="text-zinc-300">for</span> loop — the SDK makes it durable</>,
        },
        {
          label: <><code className="font-mono">Sleep</code> between passes</>,
          detail: <>durable <span className="text-zinc-300">sleep(&quot;30s&quot;)</span> — survives restarts</>,
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

  // one-shot — runs once, no replay of prior calls
  await agent.stream({
    messages: [{ role: "user", content: "Check recent orders." }],
    writable,
  })
}`,
          },
          {
            highlightLines: {
              3: "Makes this fetch [durable](https://workflow-sdk.dev/docs/foundations/workflows-and-steps) — on replay, returns the **cached result** instead of re-executing",
            },
            code: `async function fetchRecentOrders({ limit }) {
  // durable tool call — the event log replays it
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
              17: "A plain **for-loop** — the SDK makes it [durable](https://workflow-sdk.dev/docs/foundations/workflows-and-steps), not a framework abstraction",
              18: "",
              19: "",
              20: "",
              21: "",
              22: "",
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

  // agent loop — survives crashes, resumes mid-iteration
  for (let i = 0; i < 20; i++) {
    await agent.stream({
      messages: [{ role: "user", content: \`Loop \${i + 1}: check recent orders.\` }],
      writable,
      maxSteps: 6,
    })
  }
}`,
          },
          {
            highlightLines: {
              23: "[Durable sleep](https://workflow-sdk.dev/docs/api-reference/workflow/sleep) — the process can shut down; the **timer survives** across restarts",
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

  for (let i = 0; i < 20; i++) {
    await agent.stream({
      messages: [{ role: "user", content: \`Loop \${i + 1}: check recent orders.\` }],
      writable,
      maxSteps: 6,
    })
    // durable sleep — wakes back up even after a restart
    await sleep("30s")
  }
}`,
          },
        ],
      }}
    />
  );
}
