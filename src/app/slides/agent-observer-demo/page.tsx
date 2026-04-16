import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { ObserverReportPane } from "../_components/observer-report-pane";
import { AGENT_GROUPS } from "../_data/agent-groups";

const group = AGENT_GROUPS["agent-observer"];

export default function AgentObserverDemoSlide() {
  return (
    <DemoSlideLayout
      slide={group.slug}
      eyebrow={group.eyebrow}
      headline="An agent that runs while you sleep."
      subcopy="Three tool calls per loop, each a durable step. Kill the server mid-tool-call — the agent replays from the event log and picks up where it left off."
      rightPanel={<ObserverReportPane slug={group.slug} />}
    />
  );
}
