import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureCrashDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-crash"
      eyebrow="04a · The crash — watch it break"
      {...failureGroups["failure-crash"]}
      scenario={slideScenarios.naiveCrash}
    />
  );
}
