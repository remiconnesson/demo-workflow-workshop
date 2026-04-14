import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureAdminCancelDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-admin-cancel"
      eyebrow="10a · Admin cancel — watch it interrupt"
      {...failureGroups["failure-admin-cancel"]}
      scenario={slideScenarios.failureAdminCancel}
      allowAdminCancel
    />
  );
}
