import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureDriverRefusesDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-driver-refuses"
      eyebrow="09a · The refusal — watch it unwind"
      headline="Charged the card. Started cooking. No one's coming."
      marker="assignDriver"
      markerLabel="fatal → unwind"
      scenario={slideScenarios.saga}
    />
  );
}
