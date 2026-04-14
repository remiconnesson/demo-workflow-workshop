import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailureLiveUpdatesNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-live-updates"
      eyebrow="10b · Live updates — what you'd write"
      {...failureGroups["failure-live-updates"]}
      naiveCode={getFocusCode("failure-live-updates")}
    />
  );
}
