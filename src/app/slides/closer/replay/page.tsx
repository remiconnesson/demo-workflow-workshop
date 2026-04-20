import { CloserRecapSlide } from "../../_components/closer-recap-slide";

export default function CloserReplaySlide() {
  return (
    <CloserRecapSlide
      primitive="replay"
      title="Retry"
      lineNumber={15}
      setupWorry="What if the server crashes here? The customer never gets receipts."
      description="Event log resumes after crash; receipts still send."
    />
  );
}
