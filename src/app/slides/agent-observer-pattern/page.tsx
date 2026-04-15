import { PatternSlideLayout } from "../_components/pattern-slide-layout";
import { AGENT_GROUPS } from "../_data/agent-groups";

const group = AGENT_GROUPS["agent-observer"];

export default function AgentObserverPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow={group.eyebrow}
      patternName="Autonomous durable agents"
      description="An agent loop that watches, analyzes, and reports on its own — surviving restarts and resuming from its last tool call without a supervisor."
      apiPrimitive={group.pattern.apiPrimitive}
      docSection={group.pattern.docSection}
      docUrl={group.pattern.docUrl}
    />
  );
}
