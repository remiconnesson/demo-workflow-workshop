import { CloserRecapSlide } from "../../_components/closer-recap-slide";

export default function CloserSleepSlide() {
  return (
    <CloserRecapSlide
      primitive="sleep-race"
      title="Suspend"
      lineNumber={11}
      setupWorry="What if no drivers are available? The order is stuck forever."
      description="No driver times out cleanly; retry or unwind."
    />
  );
}
