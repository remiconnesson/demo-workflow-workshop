import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { AGENT_GROUPS } from "../_data/agent-groups";

const group = AGENT_GROUPS["agent-observer"];

const NAIVE_CODE = `// A process. That's it.
async function watchOrders() {
  while (true) {
    const orders = await fetchRecentOrders(25)
    const anomalies = analyze(orders)
    for (const entry of anomalies) {
      report.push(entry)
    }
    await sleep(30_000)
  }
}

// process dies -> report dies -> start over`;

export default function AgentObserverNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide={group.slug}
      eyebrow={group.eyebrow}
      headline="A process. That's it."
      marker="span"
      naiveCode={NAIVE_CODE}
    />
  );
}
