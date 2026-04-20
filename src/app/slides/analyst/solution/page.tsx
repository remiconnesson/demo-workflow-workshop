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
      statusLabel="Stable · Suspendable · Undoable"
      steps={[
        {
          label: <><span className="font-mono text-emerald-300">Stable</span> — tools become <code className="font-mono">steps</code></>,
          detail: <>tool calls <span className="text-zinc-300">replay from the log</span></>,
        },
        {
          label: <><span className="font-mono text-amber-300">Suspendable</span> — <code className="font-mono">await approvalHook</code></>,
          detail: <>agent <span className="text-zinc-300">parks mid-tool-call</span></>,
        },
        {
          label: <><span className="font-mono text-fuchsia-300">Undoable</span> — <code className="font-mono">rollbackMenuChange</code></>,
          detail: <>undo is <span className="text-zinc-300">another durable tool</span></>,
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
              3: "**stable** — [`\"use step\"`](https://workflow-sdk.dev/docs/foundations/workflows-and-steps) turns the tool into a [durable step](https://workflow-sdk.dev/docs/foundations/workflows-and-steps) — finished calls **replay from the event log** on restart (same primitive as the earlier charge scenario)",
            },
            code: `async function queryOrders({ limit }) {
  // stable: tool call replays from the event log on restart
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
              9: "**suspendable** — `await hook` parks the agent until a human taps the phone — [same hook primitive](https://workflow-sdk.dev/docs/foundations/hooks) as the slow-restaurant webhook",
              10: "",
            },
            code: `async function queryOrders({ limit }) {
  "use step"
  return db.orders.recent(limit)
}

// suspendable: await the approval hook — agent parks until a human acts
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
              12: "**undoable** — compensation is just [another tool](https://workflow-sdk.dev/docs/ai/defining-tools) the agent can call — same [saga unwind](https://workflow-sdk.dev/docs/foundations/common-patterns) from the dispute, now driven by the operator through the agent",
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

// undoable: compensation the operator invokes through the agent
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
