import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureAdminCancelDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-admin-cancel"
      eyebrow="10a · Admin cancel — watch it interrupt"
      headline="The workflow is asleep. The customer is not."
      marker={["notifyRestaurant", "assignDriver"]}
      markerLabel="interrupt from outside"
      scenario={slideScenarios.failureAdminCancel}
      allowAdminCancel
    />
  );
}
