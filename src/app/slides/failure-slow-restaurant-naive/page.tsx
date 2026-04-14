import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { failureGroups } from "../_data/failure-groups";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailureSlowRestaurantNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-slow-restaurant"
      eyebrow="06b · The slow restaurant — what you'd write"
      {...failureGroups["failure-slow-restaurant"]}
      naiveCode={getFocusCode("failure-slow-restaurant")}
    />
  );
}
