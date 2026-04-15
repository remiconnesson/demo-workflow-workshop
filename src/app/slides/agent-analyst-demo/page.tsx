import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { AGENT_GROUPS } from "../_data/agent-groups";
import { AnalystChatPane } from "../_components/analyst-chat-pane";
import { AnalystApprovalPhone } from "../_components/analyst-approval-phone";

function AnalystDemoSurface() {
  return (
    <div className="grid h-full w-full grid-cols-[1fr_320px] gap-8">
      <div className="min-h-0">
        <AnalystChatPane />
      </div>
      <div className="min-h-0">
        <AnalystApprovalPhone />
      </div>
    </div>
  );
}

export default function AgentAnalystDemoSlide() {
  const group = AGENT_GROUPS["agent-analyst"];
  return (
    <DemoSlideLayout
      slide="agent-analyst"
      eyebrow={group.eyebrow}
      headline="Ask the ops question. Watch the agent answer."
      subcopy="Every tool call streams through an approval hook before the agent touches anything that costs money or writes to production."
      rightPanel={<AnalystDemoSurface />}
    />
  );
}
