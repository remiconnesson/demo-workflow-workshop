import { FixSlideLayout } from "../_components/fix-slide-layout";

export default function FailureSlowRestaurantFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="06c · The slow restaurant — the fix"
      headline="The restaurant takes ten minutes to accept."
      marker="notifyRestaurant"
      markerLabel="suspended on a hook"
      workflowFix={{
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
      }}
    />
  );
}
