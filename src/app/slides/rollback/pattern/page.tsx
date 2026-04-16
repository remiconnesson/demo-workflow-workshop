import { PatternSlideLayout } from "../../_components/pattern-slide-layout";
import { scenarioGroups } from "../../_data/scenario-groups";

const { marker, markerLabel } = scenarioGroups["rollback"];

export default function RollbackPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="12d · The dispute — concept / pattern"
      patternName="Transactions & Rollbacks"
      description={<>Every step pushes an <code className="font-mono text-zinc-200">undo</code> as it succeeds. A post-delivery dispute <code className="font-mono text-zinc-200">hook throws</code> an error, and the workflow&apos;s <code className="font-mono text-zinc-200">catch</code> unwinds <code className="font-mono text-zinc-200">compensations in reverse</code> — even after the happy path finished.</>}
      apiPrimitive="try/catch  ·  compensations[]  ·  reverse unwind"
      docSection="Cookbook · Common Patterns"
      docUrl="workflow-sdk.dev/docs/cookbook/common-patterns/saga"
      marker={marker}
      markerLabel={markerLabel}
      realWorldExamples={[
        "Order cancellations",
        "Travel booking reversals",
        "Subscription downgrades",
        "Multi-service provisioning",
        "Inventory reservation release",
      ]}
    />
  );
}
