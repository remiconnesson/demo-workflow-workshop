import { DemoSlideLayout } from "../../_components/demo-slide-layout";
import { FirstAgentDemoPane } from "../../_components/first-agent-demo-pane";
import { AGENT_GROUPS } from "../../_data/agent-groups";

export default function AgentFirstDemoSlide() {
  const group = AGENT_GROUPS["agent-first"];
  return (
    <DemoSlideLayout
      slide={group.slug}
      eyebrow={group.eyebrow}
      headline="...an Agent loses its stream?"
      verbMapping={group.verbMapping}
      rightPanel={<FirstAgentDemoPane />}
    />
  );
}
