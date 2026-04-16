"use client";

import { useState } from "react";
import { DemoSlideLayout } from "../../_components/demo-slide-layout";
import { AGENT_GROUPS } from "../../_data/agent-groups";
import { AnalystChatPane } from "../../_components/analyst-chat-pane";
import type { AnalystDebugEvent } from "../../_components/analyst-chat-pane";
import { AnalystApprovalPhone } from "../../_components/analyst-approval-phone";
import { AgentDebugDrawer } from "../../_components/agent-debug-drawer";

function AnalystDemoSurface() {
  const [debugRunId, setDebugRunId] = useState<string | null>(null);
  const [debugEvents, setDebugEvents] = useState<AnalystDebugEvent[]>([]);

  return (
    <div className="grid h-full w-full grid-cols-[1fr_420px] gap-8">
      <div className="min-h-0">
        <AnalystChatPane
          onRunIdChange={setDebugRunId}
          onEventsChange={setDebugEvents}
        />
      </div>
      <div className="flex min-h-0 flex-col gap-4">
        <div className="shrink-0">
          <AnalystApprovalPhone />
        </div>
        <AgentDebugDrawer
          runId={debugRunId ?? undefined}
          events={debugEvents}
        />
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
      headline="...an Agent that needs undo?"
      rightPanel={<AnalystDemoSurface />}
    />
  );
}
