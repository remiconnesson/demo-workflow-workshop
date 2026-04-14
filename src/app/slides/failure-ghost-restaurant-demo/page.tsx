import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureGhostRestaurantDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-ghost-restaurant"
      eyebrow="07a · The ghost — watch it timeout"
      {...failureGroups["failure-ghost-restaurant"]}
      scenario={slideScenarios.ghostRestaurant}
    />
  );
}
