import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureSlowRestaurantDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-slow-restaurant"
      eyebrow="06a · The slow restaurant — watch it wait"
      {...failureGroups["failure-slow-restaurant"]}
      scenario={slideScenarios.naivePoll}
      highlightSteps={["notifyRestaurant"]}
    />
  );
}
