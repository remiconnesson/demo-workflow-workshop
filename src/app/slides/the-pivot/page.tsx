export default function ThePivotSlide() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col items-center justify-center gap-24 px-40 text-center">
      <p className="text-2xl font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Workflow SDK + Agents
      </p>

      <div className="flex flex-col items-center gap-6">
        <h2 className="max-w-[1800px] text-9xl font-semibold leading-[1.05] tracking-tight text-white">
          Agents,
          <br />
          <span className="text-zinc-500">meet reliability.</span>
        </h2>
        <p className="max-w-4xl text-3xl leading-snug text-zinc-400">
          Same durable run. Now the caller is an agent.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-6 font-mono text-4xl tracking-[0.3em]">
        <span className="text-sky-400">RETRY</span>
        <span aria-hidden className="text-zinc-700">·</span>
        <span className="text-amber-400">SUSPEND</span>
        <span aria-hidden className="text-zinc-700">·</span>
        <span className="text-fuchsia-400">ROLLBACK</span>
      </div>
    </div>
  );
}
