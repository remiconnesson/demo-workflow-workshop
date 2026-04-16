import { FixSlideLayout } from "../_components/fix-slide-layout";
import { AGENT_GROUPS } from "../_data/agent-groups";

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
      headline="Hooks turn the agent into an employee."
      marker="span"
      filename="analystAgent.ts"
      statusTone="amber"
      statusLabel="human-in-the-loop"
      steps={[
        {
          label: "Wrap tools as steps",
          detail: "every tool call is durable",
        },
        {
          label: "Suspend on approval hook",
          detail: "agent parks, waits for a verdict",
        },
        {
          label: "Resume with the decision",
          detail: "apply or rollback — one call away",
        },
      ]}
      workflowFix={{ code: FIX_CODE }}
    />
  );
}
