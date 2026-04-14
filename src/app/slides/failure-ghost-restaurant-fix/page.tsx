import { FixSlideLayout } from "../_components/fix-slide-layout";

export default function FailureGhostRestaurantFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="07c · The ghost — workflow code"
      headline="The restaurant never answers."
      marker="notifyRestaurant"
      markerLabel="timeout wins the race"
      workflowFix={{
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
      }}
    />
  );
}
