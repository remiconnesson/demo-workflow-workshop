import { DemoSlideLayout } from "../../_components/demo-slide-layout";
import { FirstAgentDemoPane } from "../../_components/first-agent-demo-pane";

export default function AgentFirstDemoSlide() {
  return (
    <DemoSlideLayout
      slide="agent-first"
      eyebrow="Durable agent · resumable stream"
      headline="Our first agent."
      subcopy="A DurableAgent with one slow tool. Hit F5 mid-response — the stream reconnects, the sentence finishes itself, the tool doesn't re-fire."
      rightPanel={<FirstAgentDemoPane />}
    />
  );
}
