import { PatternSlideLayout } from "../_components/pattern-slide-layout";

export default function FailureGhostRestaurantPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="07d · The ghost — concept / pattern"
      patternName="Conditional Routing"
      description="Race a hook against a sleep with Promise.race. Route based on whichever resolves first — human response or deadline."
      apiPrimitive="Promise.race([ hook, sleep() ])"
      docSection="Cookbook · Common Patterns"
      docUrl="useworkflow.dev/docs/cookbook/common-patterns/content-router"
      marker="notifyRestaurant"
      markerLabel="timeout wins the race"
    />
  );
}
