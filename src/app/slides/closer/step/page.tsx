import { CloserRecapSlide } from "../../_components/closer-recap-slide";

export default function CloserStepSlide() {
  return (
    <CloserRecapSlide
      primitive="step"
      title="Stable"
      lineNumber={5}
      setupWorry="What if the input is invalid but the next step already ran?"
      description="Result replays on retry; invalid input stops before charge."
    />
  );
}
