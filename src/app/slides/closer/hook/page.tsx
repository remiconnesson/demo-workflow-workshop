import { CloserRecapSlide } from "../../_components/closer-recap-slide";

export default function CloserHookSlide() {
  return (
    <CloserRecapSlide
      primitive="hook"
      title="Suspendable"
      lineNumber={9}
      setupWorry="What if the restaurant takes 10 minutes? This function times out."
      description="Workflow parks; the restaurant tap resumes this await."
    />
  );
}
