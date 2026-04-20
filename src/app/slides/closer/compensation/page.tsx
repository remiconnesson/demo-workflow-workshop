import { CloserRecapSlide } from "../../_components/closer-recap-slide";

export default function CloserCompensationSlide() {
  return (
    <CloserRecapSlide
      primitive="compensation"
      title="Rollback"
      lineNumber={13}
      setupWorry="What if the driver cancels? Who rolls back the restaurant?"
      description="Driver cancel throws; saga unwinds restaurant first."
    />
  );
}
