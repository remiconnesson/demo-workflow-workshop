import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailurePrepWindowNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-prep-window"
      eyebrow="08b · The wait — what you'd write"
      headline="Wait twenty minutes. Don't pay for it."
      marker={["chargePayment", "notifyRestaurant"]}
      markerLabel="20 min sleep"
      naiveCode={getFocusCode("failure-prep-window")}
    />
  );
}
