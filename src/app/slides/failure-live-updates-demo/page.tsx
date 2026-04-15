import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureLiveUpdatesDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-live-updates"
      eyebrow="10a · Live updates — watch it stream"
      {...failureGroups["failure-live-updates"]}
      scenario={slideScenarios.demo}
    />
  );
}
