import { PatternSlideLayout } from "../_components/pattern-slide-layout";
import { failureGroups } from "../_data/failure-groups";

const { marker, markerLabel } = failureGroups["failure-retry"];

const PROMPT = `npx workflow inspect run <run_id>

I just watched a demo of the Workflow SDK's Idempotency pattern, and the
run above is the one I saw. Ask me for the absolute path to my project,
cd there, then find external side effects that can't safely run twice —
payments, messaging, webhooks, queues, LLM calls — and propose diffs
that wrap each call in a "use step" function and pass
getStepMetadata().stepId as the idempotency key.

Docs: https://useworkflow.dev/docs/cookbook/common-patterns/idempotency`;

export default function FailureRetryPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="05d · The retry — concept / pattern"
      patternName="Idempotency"
      description="Every step gets a stable, deterministic ID that doesn't change across retries. Pass it to external APIs as a deduplication key."
      apiPrimitive="getStepMetadata().stepId"
      docSection="Cookbook · Common Patterns"
      docUrl="useworkflow.dev/docs/cookbook/common-patterns/idempotency"
      prompt={PROMPT}
      marker={marker}
      markerLabel={markerLabel}
    />
  );
}
