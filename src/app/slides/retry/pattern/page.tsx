import { PatternSlideLayout } from "../../_components/pattern-slide-layout";
import { scenarioGroups } from "../../_data/scenario-groups";

const { marker, markerLabel } = scenarioGroups["retry"];

const INSPECT_PROMPT = `npx workflow inspect run <run_id>

Explain this run to me in detail. Walk me through each step that
executed, which ones were retried, and how the idempotency keys
ensured no duplicate side effects. Show me exactly how
getStepMetadata().stepId stayed stable across retries.`;

const COMPARE_PROMPT = `Compare my current code to what it might look like if I was using
the Workflow SDK's Idempotency pattern. Ask me for the absolute path
to my project, cd there, then find external side effects that can't
safely run twice (payments, messaging, webhooks, queues, LLM calls)
and show me before/after diffs that wrap each call in a "use step"
function and pass getStepMetadata().stepId as the idempotency key.

API primitive: getStepMetadata().stepId
Docs: https://workflow-sdk.dev/docs/cookbook/common-patterns/idempotency`;

export default function RetryPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="05d · The retry, concept / pattern"
      patternName="Idempotency"
      description={<>Every step gets a <code className="font-mono text-zinc-200">stable, deterministic ID</code> that doesn&apos;t change across retries. Pass it to external APIs as an <code className="font-mono text-zinc-200">idempotencyKey</code>.</>}
      apiPrimitive="getStepMetadata().stepId"
      docSection="Cookbook · Common Patterns"
      docUrl="workflow-sdk.dev/docs/cookbook/common-patterns/idempotency"
      inspectPrompt={INSPECT_PROMPT}
      comparePrompt={COMPARE_PROMPT}
      marker={marker}
      markerLabel={markerLabel}
      realWorldExamples={[
        "Payment processing",
        "Email delivery",
        "Webhook delivery",
        "SMS notifications",
        "File uploads to S3",
      ]}
    />
  );
}
