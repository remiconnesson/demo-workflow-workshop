import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureGhostRestaurantDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-ghost-restaurant"
      eyebrow="07a · The ghost — watch it timeout"
      headline="You charged them. No one's cooking."
      marker="notifyRestaurant"
      markerLabel="timeout wins the race"
      scenario={slideScenarios.ghostRestaurant}
    />
  );
}
