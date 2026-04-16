import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { scenarioGroups } from "../_data/scenario-groups";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function SlowRestaurantDemoSlide() {
  return (
    <DemoSlideLayout
      slide="slow-restaurant"
      eyebrow="06a · The slow restaurant — watch it wait"
      {...scenarioGroups["slow-restaurant"]}
      subcopy="When the kitchen stays silent, the workflow suspends on a hook — hours or days — and resumes the moment a human replies."
      scenario={slideScenarios.approvalGate}
      highlightSteps={["notifyRestaurant"]}
    />
  );
}
