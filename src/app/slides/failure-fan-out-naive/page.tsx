import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailureFanOutNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-fan-out"
      eyebrow="12b · The fan-out — what you'd write"
      {...failureGroups["failure-fan-out"]}
      naiveCode={getFocusCode("failure-fan-out")}
    />
  );
}
