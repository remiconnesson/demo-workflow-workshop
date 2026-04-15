import { PatternSlideLayout } from "../_components/pattern-slide-layout";
import { AGENT_GROUPS } from "../_data/agent-groups";

export default function AgentAnalystPatternSlide() {
  const group = AGENT_GROUPS["agent-analyst"];
  return (
    <PatternSlideLayout
      eyebrow={group.eyebrow}
      patternName="Human-in-the-loop agents"
      description="A durable agent loop that can pause mid-task for operator approval and resume exactly where it left off — no retries, no lost state."
      apiPrimitive={group.pattern.apiPrimitive}
      docSection={group.pattern.docSection}
      docUrl={group.pattern.docUrl}
    />
  );
}
