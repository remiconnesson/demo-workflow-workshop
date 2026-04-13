import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureFanOutDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-fan-out"
      eyebrow="12a · The fan-out — watch it scatter"
      headline="Fan out three. Get back two. Now what?"
      marker="sendReceipt"
      markerLabel="parallel, still durable"
      scenario={slideScenarios.failureFanOut}
      highlightSteps={["sendReceipt"]}
    />
  );
}
