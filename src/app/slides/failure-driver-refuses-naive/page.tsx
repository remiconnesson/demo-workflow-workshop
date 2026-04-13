import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailureDriverRefusesNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-driver-refuses"
      eyebrow="09b · The refusal — what you'd write"
      headline="The only driver refused the job."
      marker="assignDriver"
      markerLabel="fatal → unwind"
      naiveCode={getFocusCode("failure-driver-refuses")}
    />
  );
}
