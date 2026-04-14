import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureDriverRefusesDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-driver-refuses"
      eyebrow="12a · The dispute — undo a done deal"
      {...failureGroups["failure-driver-refuses"]}
      scenario={slideScenarios.saga}
      allowDispute
    />
  );
}
