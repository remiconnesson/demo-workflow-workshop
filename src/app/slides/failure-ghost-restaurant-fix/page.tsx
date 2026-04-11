import { FailureSlideLayout } from "../_components/failure-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

const WORKFLOW_FIX = {
  caption: "Race the hook against a sleep. Whichever resolves first wins.",
  code: `const hook = createHook<{ accepted: boolean }>({
  token: \`order:\${orderId}:restaurant\`,
})

const result = await Promise.race([
  hook,
  sleep("2m").then(() => "timeout"),
])

if (result === "timeout") {
  throw new FatalError("Timed out")
}`,
};

export default function FailureGhostRestaurantFixSlide() {
  return (
    <FailureSlideLayout
      slide="failure-ghost-restaurant"
      eyebrow="07b · The ghost — the fix"
      headline="The restaurant never answers."
      marker="notifyRestaurant"
      markerLabel="timeout wins the race"
      scenario={slideScenarios.ghostRestaurant}
      workflowFix={WORKFLOW_FIX}
    />
  );
}
