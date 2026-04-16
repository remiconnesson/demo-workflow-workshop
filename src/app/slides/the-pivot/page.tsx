export default function ThePivotSlide() {
  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col items-center justify-center gap-16 px-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Workflow SDK + Agents
      </p>

      <h2 className="max-w-6xl text-7xl font-semibold leading-[1.05] tracking-tight text-white">
        Agents,
        <br />
        <span className="text-zinc-500">meet reliability.</span>
      </h2>

      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 font-mono text-2xl tracking-[0.3em]">
        <span className="text-sky-400">RETRY</span>
        <span aria-hidden className="text-zinc-700">·</span>
        <span className="text-amber-400">SUSPEND</span>
        <span aria-hidden className="text-zinc-700">·</span>
        <span className="text-fuchsia-400">ROLLBACK</span>
      </div>
    </div>
  );
}
