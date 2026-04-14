import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailurePrepWindowDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-prep-window"
      eyebrow="08a · The bakery needs 20 minutes before the kitchen starts"
      {...failureGroups["failure-prep-window"]}
      scenario={slideScenarios.failurePrepWindow}
      showSleepCost
    />
  );
}
