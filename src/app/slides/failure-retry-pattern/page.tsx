import { PatternSlideLayout } from "../_components/pattern-slide-layout";
import { failureGroups } from "../_data/failure-groups";

const { marker, markerLabel } = failureGroups["failure-retry"];

export default function FailureRetryPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="05d · The retry — concept / pattern"
      patternName="Idempotency"
      description="Every step gets a stable, deterministic ID that doesn't change across retries. Pass it to external APIs as a deduplication key."
      apiPrimitive="getStepMetadata().stepId"
      docSection="Cookbook · Common Patterns"
      docUrl="useworkflow.dev/docs/cookbook/common-patterns/idempotency"
      marker={marker}
      markerLabel={markerLabel}
    />
  );
}
