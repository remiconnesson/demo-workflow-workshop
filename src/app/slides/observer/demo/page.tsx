import { DemoSlideLayout } from "../../_components/demo-slide-layout";
import { ObserverReportPane } from "../../_components/observer-report-pane";
import { AGENT_GROUPS } from "../../_data/agent-groups";

const group = AGENT_GROUPS["agent-observer"];

export default function AgentObserverDemoSlide() {
  return (
    <DemoSlideLayout
      slide={group.slug}
      eyebrow={group.eyebrow}
      headline="... an Agent loses its server?"
      rightPanel={<ObserverReportPane slug={group.slug} />}
    />
  );
}
