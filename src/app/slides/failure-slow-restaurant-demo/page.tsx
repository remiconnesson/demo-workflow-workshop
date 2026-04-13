import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureSlowRestaurantDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-slow-restaurant"
      eyebrow="06a · The slow restaurant — watch it wait"
      headline="The restaurant takes ten minutes to accept."
      marker="notifyRestaurant"
      markerLabel="suspended on a hook"
      scenario={slideScenarios.hooks}
      highlightSteps={["notifyRestaurant"]}
    />
  );
}
