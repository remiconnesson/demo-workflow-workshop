import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { ObserverReportPane } from "../_components/observer-report-pane";
import { AGENT_GROUPS } from "../_data/agent-groups";

const group = AGENT_GROUPS["agent-observer"];

export default function AgentObserverDemoSlide() {
  return (
    <DemoSlideLayout
      slide={group.slug}
      eyebrow={group.eyebrow}
      headline="The agent that's been watching the whole time."
      subcopy="While the workflow runs, the agent tails the event stream and surfaces a live report the moment anything looks off."
      rightPanel={<ObserverReportPane />}
    />
  );
}
