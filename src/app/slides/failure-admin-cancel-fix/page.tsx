import { FixSlideLayout } from "../_components/fix-slide-layout";

export default function FailureAdminCancelFixSlide() {
  return (
    <FixSlideLayout
      eyebrow="10c · Admin cancel — the fix"
      headline="Support needs to cancel a sleeping order."
      marker={["notifyRestaurant", "assignDriver"]}
      markerLabel="interrupt from outside"
      workflowFix={{
        caption: "Run.wakeUp() interrupts any sleeping workflow from outside.",
        code: `import { getRun } from "workflow/api"

// admin dashboard — one API call
const run = getRun(runId)
await run.wakeUp()

// inside the workflow, after sleep:
// sleep returns early → workflow checks
// reason → throws FatalError → saga unwinds`,
      }}
    />
  );
}
