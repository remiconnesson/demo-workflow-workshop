import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailurePrepWindowNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-prep-window"
      eyebrow="08b · The wait — what you'd write"
      {...failureGroups["failure-prep-window"]}
      naiveCode={getFocusCode("failure-prep-window")}
    />
  );
}
