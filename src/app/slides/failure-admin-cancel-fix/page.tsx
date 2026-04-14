import { FixSlideLayout } from "../_components/fix-slide-layout";
import { failureGroups } from "../_data/failure-groups";

export default function FailureAdminCancelFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="09c · Admin cancel — workflow code"
      {...failureGroups["failure-admin-cancel"]}
      workflowFix={{
        code: `// Resume a cancel hook for intent, then call
// getRun(runId).wakeUp() to break a pending sleep.
import { getRun, resumeHook } from "workflow/api"

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
