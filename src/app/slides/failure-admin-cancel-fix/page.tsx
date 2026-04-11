import { FailureSlideLayout } from "../_components/failure-slide-layout";
import { slideScenarios } from "../_lib/slide-scenarios";

const WORKFLOW_FIX = {
  caption: "Run.wakeUp() interrupts any sleeping workflow from outside.",
  code: `import { getRun } from "workflow/api"

// admin dashboard — one API call
const run = getRun(runId)
await run.wakeUp()

// inside the workflow, after sleep:
// sleep returns early → workflow checks
// reason → throws FatalError → saga unwinds`,
};

export default function FailureAdminCancelFixSlide() {
  return (
    <FailureSlideLayout
      slide="failure-admin-cancel"
      eyebrow="10b · Admin cancel — the fix"
      headline="Support needs to cancel a sleeping order."
      marker={["notifyRestaurant", "assignDriver"]}
      markerLabel="interrupt from outside"
      scenario={slideScenarios.failureAdminCancel}
      allowAdminCancel
      workflowFix={WORKFLOW_FIX}
    />
  );
}
