import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailureSlowRestaurantNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-slow-restaurant"
      eyebrow="06b · The slow restaurant — what you'd write"
      headline="The restaurant takes ten minutes to accept."
      marker="notifyRestaurant"
      markerLabel="suspended on a hook"
      naiveCode={getFocusCode("failure-slow-restaurant")}
    />
  );
}
