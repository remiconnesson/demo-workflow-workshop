import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailureGhostRestaurantNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-ghost-restaurant"
      eyebrow="07b · The ghost — what you'd write"
      {...failureGroups["failure-ghost-restaurant"]}
      naiveCode={getFocusCode("failure-ghost-restaurant")}
    />
  );
}
