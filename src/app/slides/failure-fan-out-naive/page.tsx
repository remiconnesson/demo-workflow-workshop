import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailureFanOutNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-fan-out"
      eyebrow="12a · The fan-out — what you'd write"
      headline="Three notifications. One fails."
      marker="sendReceipt"
      markerLabel="parallel, still durable"
      naiveCode={getFocusCode("failure-fan-out")}
    />
  );
}
