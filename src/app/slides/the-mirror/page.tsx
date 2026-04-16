const ROWS = [
  {
    left: "Step",
    leftClass: "text-sky-400",
    right: "Agent's tool retries transparently",
  },
  {
    left: "Hook",
    leftClass: "text-amber-400",
    right: "Agent suspends for human approval",
  },
  {
    left: "Compensation",
    leftClass: "text-fuchsia-400",
    right: "Agent rolls back its own decision",
  },
] as const;

export default function TheMirrorSlide() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-12 px-20">
      <h2 className="text-5xl font-semibold tracking-tight text-white">
        The same primitives.
        <span className="text-zinc-500"> Now handed to the AI.</span>
      </h2>

      <div className="rounded-2xl border border-white/10 bg-zinc-950">
        <div className="grid grid-cols-[360px_1fr] border-b border-white/10 px-10 py-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Workflow primitive
          </p>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Agent behavior
          </p>
        </div>

        {ROWS.map((row, i) => (
          <div
            key={row.left}
            className={`grid min-h-[92px] grid-cols-[360px_1fr] items-center px-10 py-5 ${
              i < ROWS.length - 1 ? "border-b border-white/5" : ""
            }`}
          >
            <div
              className={`font-mono text-3xl font-semibold tracking-tight ${row.leftClass}`}
            >
              {row.left}
            </div>
            <div className="text-2xl text-zinc-200">{row.right}</div>
          </div>
        ))}
      </div>

      <p className="text-4xl font-semibold leading-snug tracking-tight text-white">
        Durability is the substrate
        <span className="text-zinc-500"> that makes autonomy safe.</span>
      </p>
    </div>
  );
}
