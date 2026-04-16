import { PatternSlideLayout } from "../../_components/pattern-slide-layout";
import { scenarioGroups } from "../../_data/scenario-groups";

const { marker, markerLabel } = scenarioGroups["retry"];

const PROMPT = `npx workflow inspect run <run_id>

I just watched a demo of the Workflow SDK's Idempotency pattern, and the
run above is the one I saw. Ask me for the absolute path to my project,
cd there, then find external side effects that can't safely run twice —
payments, messaging, webhooks, queues, LLM calls — and propose diffs
that wrap each call in a "use step" function and pass
getStepMetadata().stepId as the idempotency key.

Docs: https://workflow-sdk.dev/docs/cookbook/common-patterns/idempotency`;

export default function RetryPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="05d · The retry — concept / pattern"
      patternName="Idempotency"
      description={<>Every step gets a <code className="font-mono text-zinc-200">stable, deterministic ID</code> that doesn&apos;t change across retries. Pass it to external APIs as an <code className="font-mono text-zinc-200">idempotencyKey</code>.</>}
      apiPrimitive="getStepMetadata().stepId"
      docSection="Cookbook · Common Patterns"
      docUrl="workflow-sdk.dev/docs/cookbook/common-patterns/idempotency"
      prompt={PROMPT}
      marker={marker}
      markerLabel={markerLabel}
      realWorldExamples={[
        "Payment processing",
        "Email delivery",
        "Webhook dispatch",
        "Database migrations",
        "File uploads to S3",
      ]}
    />
  );
}
