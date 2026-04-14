import { PatternSlideLayout } from "../_components/pattern-slide-layout";

export default function FailureLiveUpdatesPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow="11d · The pattern"
      patternName="Streaming"
      description="Steps write progress, status, or data to a stream in real time. Clients can read that stream over HTTP without a separate WebSocket or pubsub system."
      apiPrimitive="getWritable()"
      docSection="Foundations"
      docUrl="useworkflow.dev/docs/foundations/streaming"
      marker="span"
      markerLabel="streamed end-to-end"
    />
  );
}
