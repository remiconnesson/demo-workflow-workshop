import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailurePrepWindowDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-prep-window"
      eyebrow="08a · The bakery needs 20 minutes before the kitchen starts"
      headline="Nothing happens for twenty minutes. Something has to remember."
      marker={["chargePayment", "notifyRestaurant"]}
      markerLabel="20 min sleep"
      scenario={slideScenarios.failurePrepWindow}
      showSleepCost
    />
  );
}
