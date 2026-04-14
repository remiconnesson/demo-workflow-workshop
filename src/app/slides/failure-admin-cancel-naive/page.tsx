import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailureAdminCancelNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-admin-cancel"
      eyebrow="10b · Admin cancel — what you'd write"
      {...failureGroups["failure-admin-cancel"]}
      naiveCode={getFocusCode("failure-admin-cancel")}
    />
  );
}
