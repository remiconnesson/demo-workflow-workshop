import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailurePrepWindowDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-prep-window"
      eyebrow="08a · The wait — watch it sleep"
      headline="Wait twenty minutes. Don't pay for it."
      marker={["chargePayment", "notifyRestaurant"]}
      markerLabel="20 min sleep"
      scenario={slideScenarios.failurePrepWindow}
    />
  );
}
