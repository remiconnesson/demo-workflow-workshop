import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { getFocusCode } from "../_data/naive-accumulation";

export default function FailureGhostRestaurantNaiveSlide() {
  return (
    <NaiveSlideLayout
      slide="failure-ghost-restaurant"
      eyebrow="07b · The ghost — what you'd write"
      headline="The restaurant never answers."
      marker="notifyRestaurant"
      markerLabel="timeout wins the race"
      naiveCode={getFocusCode("failure-ghost-restaurant")}
    />
  );
}
