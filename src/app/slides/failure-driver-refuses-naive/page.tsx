import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailureDriverRefusesNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-driver-refuses"
      eyebrow="12b · The dispute — what you'd write"
      {...failureGroups["failure-driver-refuses"]}
      naiveCode={getFocusCode("failure-driver-refuses")}
    />
  );
}
