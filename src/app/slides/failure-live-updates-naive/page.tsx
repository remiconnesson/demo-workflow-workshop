import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailureLiveUpdatesNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-live-updates"
      eyebrow="11a · Live updates — what you'd write"
      headline="The customer is staring at a spinner."
      marker="span"
      markerLabel="streamed end-to-end"
      naiveCode={getFocusCode("failure-live-updates")}
    />
  );
}
