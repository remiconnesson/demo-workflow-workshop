import { PatternSlideLayout } from "../_components/pattern-slide-layout";
import { AGENT_GROUPS } from "../_data/agent-groups";

const group = AGENT_GROUPS["agent-first"];

export default function AgentFirstPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow={group.eyebrow}
      patternName="Resumable streams"
      description="A durable agent whose chat stream survives page refreshes, network drops, and serverless timeouts. The client reconnects to the same run — no re-prompt, no lost tokens."
      apiPrimitive={group.pattern.apiPrimitive}
      docSection={group.pattern.docSection}
      docUrl={group.pattern.docUrl}
    />
  );
}
