import { FixSlideLayout } from "../../_components/fix-slide-layout";
import { AGENT_GROUPS } from "../../_data/agent-groups";

const group = AGENT_GROUPS["agent-analyst"];

export default function AgentAnalystFixSlide() {
  return (
    <FixSlideLayout
      slide="agent-analyst"
      eyebrow={group.eyebrow}
      headline="The whole workshop — in one agent."
      marker="span"
      filename="analystAgent.ts"
      statusTone="emerald"
      statusLabel="retry · suspend · rollback"
      steps={[
        {
          label: <><span className="font-mono text-emerald-300">retry</span> — tools become <code className="font-mono">steps</code></>,
          detail: <>every tool call <span className="text-zinc-300">replays from the event log</span> — same primitive as the charge</>,
        },
        {
          label: <><span className="font-mono text-amber-300">suspend</span> — <code className="font-mono">await approvalHook</code></>,
          detail: <>agent <span className="text-zinc-300">parks mid-tool-call</span> — same primitive as the slow restaurant</>,
        },
        {
          label: <><span className="font-mono text-fuchsia-300">rollback</span> — <code className="font-mono">rollbackMenuChange</code></>,
          detail: <>compensation becomes a tool the agent <span className="text-zinc-300">can call on request</span> — same unwind as the dispute</>,
        },
      ]}
      workflowFix={{
        progression: [
          {
            code: `async function queryOrders({ limit }) {
  return db.orders.recent(limit)
}

export async function analystAgentWorkflow(messages: ChatMessage[]) {
  "use workflow"

  const writable = getWritable<UIMessageChunk>()
  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: { queryOrders },
  })

  return agent.stream({ messages, writable, maxSteps: 12 })
}`,
          },
          {
            highlightLines: {
              2: "",
              3: "**retry** — [`\"use step\"`](https://workflow-sdk.dev/docs/foundations/workflows-and-steps) turns the tool into a [durable step](https://workflow-sdk.dev/docs/foundations/workflows-and-steps) — finished calls **replay from the event log** on restart (same primitive as Act II's charge)",
            },
            code: `async function queryOrders({ limit }) {
  // retry: tool call replays from the event log on restart
  "use step"
  return db.orders.recent(limit)
}

export async function analystAgentWorkflow(messages: ChatMessage[]) {
  "use workflow"

  const writable = getWritable<UIMessageChunk>()
  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: { queryOrders },
  })

  return agent.stream({ messages, writable, maxSteps: 12 })
}`,
          },
          {
            highlightLines: {
              6: "",
              7: "",
              8: "[`hook.create({ token })`](https://workflow-sdk.dev/docs/ai/human-in-the-loop) — the UI references this token to submit the approval",
              9: "**suspend** — `await hook` parks the agent until a human taps the phone — [same hook primitive](https://workflow-sdk.dev/docs/foundations/hooks) as the slow-restaurant webhook",
              10: "",
            },
            code: `async function queryOrders({ limit }) {
  "use step"
  return db.orders.recent(limit)
}

// suspend: await the approval hook — agent parks until a human acts
async function requestApproval({ proposalId }, { toolCallId }) {
  const hook = approvalHook.create({ token: toolCallId })
  return await hook
}

export async function analystAgentWorkflow(messages: ChatMessage[]) {
  "use workflow"

  const writable = getWritable<UIMessageChunk>()
  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: { queryOrders, requestApproval },
  })

  return agent.stream({ messages, writable, maxSteps: 12 })
}`,
          },
          {
            highlightLines: {
              11: "",
              12: "**rollback** — compensation is just [another tool](https://workflow-sdk.dev/docs/ai/defining-tools) the agent can call — same [saga unwind](https://workflow-sdk.dev/docs/foundations/common-patterns) from the dispute, now driven by the operator through the agent",
              13: "",
              14: "",
              15: "",
            },
            code: `async function queryOrders({ limit }) {
  "use step"
  return db.orders.recent(limit)
}

async function requestApproval({ proposalId }, { toolCallId }) {
  const hook = approvalHook.create({ token: toolCallId })
  return await hook
}

// rollback: compensation the operator invokes through the agent
async function rollbackMenuChange({ changeId }) {
  "use step"
  return menu.rollback(changeId)
}

export async function analystAgentWorkflow(messages: ChatMessage[]) {
  "use workflow"

  const writable = getWritable<UIMessageChunk>()
  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: { queryOrders, requestApproval, rollbackMenuChange },
  })

  return agent.stream({ messages, writable, maxSteps: 12 })
}`,
          },
        ],
      }}
    />
  );
}
