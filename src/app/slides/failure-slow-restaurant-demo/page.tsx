import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureSlowRestaurantDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-slow-restaurant"
      eyebrow="06a · The slow restaurant — watch it wait"
      {...failureGroups["failure-slow-restaurant"]}
      subcopy="When the kitchen stays silent, the workflow suspends on a hook — hours or days — and resumes the moment a human replies."
      scenario={slideScenarios.approvalGate}
      highlightSteps={["notifyRestaurant"]}
    />
  );
}
