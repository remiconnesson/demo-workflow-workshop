import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { scenarioGroups } from "../_data/scenario-groups";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function DisputeDemoSlide() {
  return (
    <DemoSlideLayout
      slide="dispute"
      eyebrow="12a · The dispute — undo a done deal"
      {...scenarioGroups["dispute"]}
      subcopy="A post-delivery hook lets any stakeholder unwind the saga — every prior compensation fires in reverse."
      scenario={slideScenarios.saga}
      allowDispute
    />
  );
}
