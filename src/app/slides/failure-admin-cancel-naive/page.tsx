import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailureAdminCancelNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-admin-cancel"
      eyebrow="10b · Admin cancel — what you'd write"
      headline="Support needs to cancel a sleeping order."
      marker={["notifyRestaurant", "assignDriver"]}
      markerLabel="interrupt from outside"
      naiveCode={getFocusCode("failure-admin-cancel")}
    />
  );
}
