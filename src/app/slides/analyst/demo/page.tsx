"use client";

import { useState } from "react";
import { DemoSlideLayout } from "../../_components/demo-slide-layout";
import { AGENT_GROUPS } from "../../_data/agent-groups";
import { AnalystChatPane } from "../../_components/analyst-chat-pane";
import type { AnalystDebugEvent } from "../../_components/analyst-chat-pane";
import { AnalystApprovalPhone } from "../../_components/analyst-approval-phone";
import { AgentDebugDrawer } from "../../_components/agent-debug-drawer";
import { useSlidesDebug } from "../../_components/slides-debug-context";

function AnalystDemoSurface() {
  const debugOpen = useSlidesDebug();
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
      <div
        className={`flex min-h-0 flex-col ${
          debugOpen ? "gap-4" : "justify-center"
        }`}
      >
        <div className={debugOpen ? "shrink-0" : "flex flex-1 items-center"}>
          <AnalystApprovalPhone />
        </div>
        {debugOpen ? (
          <AgentDebugDrawer
            runId={debugRunId ?? undefined}
            events={debugEvents}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function AgentAnalystDemoSlide() {
  const group = AGENT_GROUPS["agent-analyst"];
  return (
    <DemoSlideLayout
      slide={group.slug}
      eyebrow={group.eyebrow}
      headline="...an Agent that needs undo?"
      verbMapping={group.verbMapping}
      rightPanel={<AnalystDemoSurface />}
    />
  );
}
