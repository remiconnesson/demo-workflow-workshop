import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureCrashDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-crash"
      eyebrow="04a · The crash — watch it break"
      headline="The money moved. The order didn't."
      marker={["chargePayment", "notifyRestaurant"]}
      markerLabel="crash here"
      scenario={slideScenarios.failureCrash}
      allowCrash
    />
  );
}
