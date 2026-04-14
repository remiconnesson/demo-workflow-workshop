import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureDriverRefusesDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-driver-refuses"
      eyebrow="09a · The refusal — watch it unwind"
      {...failureGroups["failure-driver-refuses"]}
      scenario={slideScenarios.saga}
    />
  );
}
