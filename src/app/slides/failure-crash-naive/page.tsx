import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailureCrashNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-crash"
      eyebrow="04b · The crash — what you'd write"
      {...failureGroups["failure-crash"]}
      naiveCode={getFocusCode("failure-crash")}
    />
  );
}
