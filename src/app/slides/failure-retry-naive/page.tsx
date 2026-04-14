import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailureRetryNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-retry"
      eyebrow="05b · The retry — what you'd write"
      {...failureGroups["failure-retry"]}
      naiveCode={getFocusCode("failure-retry")}
    />
  );
}
