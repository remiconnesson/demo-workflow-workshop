import { FixSlideLayout } from "../_components/fix-slide-layout";

export default function FailureAdminCancelFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="10c · Admin cancel — workflow code"
      headline="Support needs to cancel a sleeping order."
      marker={["notifyRestaurant", "assignDriver"]}
      markerLabel="interrupt from outside"
      workflowFix={{
        caption:
          "Resume a cancel hook for intent, then call Run.wakeUp() if you need to break a pending sleep right away.",
        code: `import { getRun, resumeHook } from "workflow/api"

// admin dashboard — one API call
await resumeHook(\`order:\${orderId}:admin-cancel\`, {
  cancelled: true,
  reason: "support",
})
await getRun(runId).wakeUp()

// inside the workflow:
// Promise.race(cancelHook, sleep("6s"))
// wakeUp() lets the sleep resolve early
// the resumed hook provides the cancel reason`,
      }}
    />
  );
}
