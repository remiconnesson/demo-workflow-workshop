import { FailureSlideLayout } from "../_components/failure-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

const WORKFLOW_FIX = {
  caption: "createHook suspends the workflow. No webhook. No worker. No polling.",
  code: `// inside placeOrder ("use workflow"):
const hook = createHook<{ accepted: boolean }>({
  token: \`order:\${orderId}:restaurant\`,
})

// workflow suspends here — no cost
const result = await hook

if (!result.accepted) {
  throw new FatalError("Rejected")
}`,
};

export default function FailureSlowRestaurantFixSlide() {
  return (
    <FailureSlideLayout
      slide="failure-slow-restaurant"
      eyebrow="06b · The slow restaurant — the fix"
      headline="The restaurant takes ten minutes to accept."
      marker="notifyRestaurant"
      markerLabel="suspended on a hook"
      scenario={slideScenarios.hooks}
      highlightSteps={["notifyRestaurant"]}
      workflowFix={WORKFLOW_FIX}
    />
  );
}
