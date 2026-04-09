import { LiveOrderConceptLab } from "../_components/live-order-concept-lab";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function DemoSlide() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-10 px-20">
      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
        The Demo
      </div>
      <h2 className="text-5xl font-semibold tracking-tight">
        Triangle Donuts, live
      </h2>
      <LiveOrderConceptLab slide="demo" scenario={slideScenarios.demo} />
    </div>
  );
}
