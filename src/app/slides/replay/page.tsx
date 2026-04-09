import { ReplayLab } from "../_components/foundations/replay-lab";

export default function ReplaySlide() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-10 px-20">
      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Deterministic Replay
      </div>
      <h2 className="text-5xl font-semibold tracking-tight">
        How the runtime recovers
      </h2>
      <ReplayLab />
    </div>
  );
}
