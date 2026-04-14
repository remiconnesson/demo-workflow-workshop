import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureLiveUpdatesDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-live-updates"
      eyebrow="11a · Live updates — watch it stream"
      {...failureGroups["failure-live-updates"]}
      scenario={slideScenarios.naiveNoStream}
    />
  );
}
