import { CloserRecapSlide } from "../../_components/closer-recap-slide";

export default function CloserCompensationSlide() {
  return (
    <CloserRecapSlide
      primitive="compensation"
      title="Undoable"
      lineNumber={8}
      setupWorry="What if the customer cancels? Who rolls back the restaurant?"
      description="Customer cancel throws; saga unwinds restaurant first."
    />
  );
}
