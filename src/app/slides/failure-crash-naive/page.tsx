import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailureCrashNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-crash"
      eyebrow="04b · The crash — what you'd write"
      headline="It's 2am. The server just died."
      marker={["chargePayment", "notifyRestaurant"]}
      markerLabel="crash here"
      naiveCode={getFocusCode("failure-crash")}
    />
  );
}
