import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureLiveUpdatesDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-live-updates"
      eyebrow="11a · Live updates — watch it stream"
      headline="The customer is staring at a spinner."
      marker="span"
      markerLabel="streamed end-to-end"
      scenario={slideScenarios.streaming}
    />
  );
}
