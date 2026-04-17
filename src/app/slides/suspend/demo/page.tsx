import { DemoSlideLayout } from "../../_components/demo-slide-layout";
import { scenarioGroups } from "../../_data/scenario-groups";
import { slideScenarios } from "../../_lib/slide-scenarios";

export default function SuspendDemoSlide() {
  return (
    <DemoSlideLayout
      slide="suspend"
      eyebrow="06a · The slow restaurant"
      {...scenarioGroups["suspend"]}
      scenario={slideScenarios.approvalGate}
      highlightSteps={["pingRestaurant"]}
    />
  );
}
