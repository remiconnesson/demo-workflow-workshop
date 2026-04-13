import { LiveOrderConceptLab } from "../_components/live-order-concept-lab";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function TheDemoSlide() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-10 px-20">
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          The order
        </div>
        <h2 className="mt-3 text-6xl font-semibold tracking-tight">
          Triangle Donuts #4271
        </h2>
        <p className="mt-3 text-2xl text-zinc-400">
          Six steps. End to end. Remember what this feels like when it works.
        </p>
      </div>
      <LiveOrderConceptLab slide="the-demo" scenario={slideScenarios.demo} />
    </div>
  );
}
