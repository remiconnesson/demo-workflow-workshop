import { FixSlideLayout } from "../../_components/fix-slide-layout";
import { AGENT_GROUPS } from "../../_data/agent-groups";

const FIX_CODE = `export async function analystAgentWorkflow(messages: ChatMessage[]) {
  "use workflow"

  const writable = getWritable<UIMessageChunk>()
  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: {
      queryOrders: { execute: queryOrders, /* "use step" */ },
      proposeMenuChange: { execute: proposeMenuChange },
      requestApproval: {
        // Suspend the agent, wait for a human.
        execute: async ({ proposalId }) => {
          const hook = approvalHook.create({
            token: \`analyst-approval:\${proposalId}\`,
          })
          const decision = await hook       // ← resumable pause
          hook.dispose()
          return decision
        },
      },
      applyMenuChange: { execute: applyMenuChange },
      rollbackMenuChange: { execute: rollbackMenuChange },
    },
  })

  return agent.stream({ messages, writable, maxSteps: 12 })
}`;

export default function AgentAnalystFixSlide() {
  const group = AGENT_GROUPS["agent-analyst"];
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
        code: FIX_CODE,
        highlightLines: {
          2: "`use workflow` — the agent conversation is a [durable workflow](https://workflow-sdk.dev/docs/foundations/workflows-and-steps) that survives restarts",
          8: "**retry** — tools with [\"use step\"](https://workflow-sdk.dev/docs/foundations/workflows-and-steps) become durable; the event log replays finished calls on restart (same primitive as the [charge retry](https://workflow-sdk.dev/docs/foundations/workflows-and-steps))",
          13: "**suspend** — the [approval hook](https://workflow-sdk.dev/docs/ai/human-in-the-loop) creates a unique gate the agent will await",
          16: "**suspend** — `await hook` parks the agent until a human taps the phone — [same hook primitive](https://workflow-sdk.dev/docs/foundations/hooks) as the slow-restaurant webhook",
          22: "**rollback** — compensation is a [tool the agent can call](https://workflow-sdk.dev/docs/ai/defining-tools) any turn — same saga unwind from Act II, now driven by the operator asking the agent to undo",
        },
      }}
    />
  );
}
