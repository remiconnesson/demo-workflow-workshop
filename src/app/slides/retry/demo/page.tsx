import { DemoSlideLayout } from "../../_components/demo-slide-layout";
import { scenarioGroups } from "../../_data/scenario-groups";
import { slideScenarios } from "../../_lib/slide-scenarios";

export default function RetryDemoSlide() {
  return (
    <DemoSlideLayout
      slide="retry"
      eyebrow="05a · The retry"
      {...scenarioGroups["retry"]}
      scenario={slideScenarios.naiveDoubleCharge}
      highlightSteps={["chargeCard"]}
    />
  );
}
