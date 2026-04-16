import { DemoSlideLayout } from "../../_components/demo-slide-layout";
import { FirstAgentDemoPane } from "../../_components/first-agent-demo-pane";

export default function AgentFirstDemoSlide() {
  return (
    <DemoSlideLayout
      slide="agent-first"
      eyebrow="Durable agent · resumable stream"
      headline="...an Agent loses its stream?"
      rightPanel={<FirstAgentDemoPane />}
    />
  );
}
