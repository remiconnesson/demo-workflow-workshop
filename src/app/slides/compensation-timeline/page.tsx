import { LiveOrderConceptLab } from "../_components/live-order-concept-lab";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function CompensationTimelineSlide() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-10 px-20">
      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Compensation Timeline
      </div>
      <h2 className="text-5xl font-semibold tracking-tight">
        Driver declines, rollback begins
      </h2>
      <LiveOrderConceptLab
        slide="compensation-timeline"
        scenario={slideScenarios.compensationTimeline}
      />
    </div>
  );
}
