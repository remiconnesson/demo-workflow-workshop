import { PatternSlideLayout } from "../_components/pattern-slide-layout";
import { failureGroups } from "../_data/failure-groups";

const { marker, markerLabel } = failureGroups["failure-live-updates"];

export default function FailureLiveUpdatesPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="10d · Live updates — concept / pattern"
      patternName="Streaming"
      description="Steps write progress, status, or data to a stream in real time. Clients can read that stream over HTTP without a separate WebSocket or pubsub system."
      apiPrimitive="getWritable()"
      docSection="Foundations"
      docUrl="useworkflow.dev/docs/foundations/streaming"
      marker={marker}
      markerLabel={markerLabel}
    />
  );
}
