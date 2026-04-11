import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailureRetryNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-retry"
      eyebrow="05a · The retry — what you'd write"
      headline="The charge ran twice."
      marker="chargePayment"
      markerLabel="payment flaked"
      naiveCode={getFocusCode("failure-retry")}
    />
  );
}
