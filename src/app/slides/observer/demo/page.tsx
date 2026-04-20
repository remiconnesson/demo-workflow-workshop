import { DemoSlideLayout } from "../../_components/demo-slide-layout";
import { ObserverChatPane } from "../../_components/observer-chat-pane";
import { AGENT_GROUPS } from "../../_data/agent-groups";

const group = AGENT_GROUPS["agent-observer"];

export default function AgentObserverDemoSlide() {
  return (
    <DemoSlideLayout
      slide={group.slug}
      eyebrow={group.eyebrow}
      headline="... an Agent loses its server?"
      verbMapping={group.verbMapping}
      rightPanel={<ObserverChatPane slug={group.slug} />}
    />
  );
}
