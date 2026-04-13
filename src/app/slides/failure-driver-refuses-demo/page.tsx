import { DemoSlideLayout } from "../_components/demo-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function FailureDriverRefusesDemoSlide() {
  return (
    <DemoSlideLayout
      slide="failure-driver-refuses"
      eyebrow="09a · The refusal — watch it unwind"
      headline="The only driver refused the job."
      marker="assignDriver"
      markerLabel="fatal → unwind"
      scenario={slideScenarios.saga}
    />
  );
}
