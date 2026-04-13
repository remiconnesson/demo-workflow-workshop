import { FixSlideLayout } from "../_components/fix-slide-layout";

export default function FailureCrashFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="04c · The crash — the fix"
      headline="It's 2am. The server just died."
      marker={["chargePayment", "notifyRestaurant"]}
      markerLabel="crash here"
      workflowFix={{
        caption: "Same six awaits. Two directives. The runtime replays from the event log.",
        code: `"use workflow"
"use step"`,
      }}
    />
  );
}
