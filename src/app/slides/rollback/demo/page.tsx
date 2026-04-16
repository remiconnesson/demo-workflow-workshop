import { DemoSlideLayout } from "../../_components/demo-slide-layout";
import { scenarioGroups } from "../../_data/scenario-groups";
import { slideScenarios } from "../../_lib/slide-scenarios";

export default function RollbackDemoSlide() {
  return (
    <DemoSlideLayout
      slide="rollback"
      eyebrow="12a · The dispute"
      {...scenarioGroups["rollback"]}
      scenario={slideScenarios.saga}
      allowDispute
    />
  );
}
