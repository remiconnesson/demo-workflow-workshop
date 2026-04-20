import { CloserRecapSlide } from "../../_components/closer-recap-slide";

export default function CloserIdempotencySlide() {
  return (
    <CloserRecapSlide
      primitive="idempotency"
      title="Stable"
      lineNumber={7}
      setupWorry="What if this fails halfway? The customer gets charged twice."
      description="stepId keys Stripe; retry returns the original charge."
    />
  );
}
