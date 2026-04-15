import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureDriverRefusesDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-driver-refuses"
      eyebrow="12a · The dispute — undo a done deal"
      {...failureGroups["failure-driver-refuses"]}
      subcopy="A post-delivery hook lets any stakeholder unwind the saga — every prior compensation fires in reverse."
      scenario={slideScenarios.saga}
      allowDispute
    />
  );
}
