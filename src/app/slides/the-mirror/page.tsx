const ROWS = [
  {
    verb: "Retry",
    verbClass: "text-sky-400",
    workflow: "Charge didn't double.",
    agent: "Observer replayed without re-executing.",
  },
  {
    verb: "Suspend",
    verbClass: "text-amber-400",
    workflow: "Waited for the restaurant.",
    agent: "Analyst paused for a human.",
  },
  {
    verb: "Rollback",
    verbClass: "text-fuchsia-400",
    workflow: "Unwound the dispute.",
    agent: "Agent reversed its own decision.",
  },
] as const;

export default function TheMirrorSlide() {
  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-center gap-12 px-20">
      <h2 className="text-5xl font-semibold tracking-tight text-white">
        Three verbs.
        <span className="text-zinc-500"> You already learned them.</span>
      </h2>

      <div className="rounded-2xl border border-white/10 bg-zinc-950">
        <div className="grid grid-cols-[200px_1fr_1fr] border-b border-white/10 px-10 py-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Verb
          </p>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Workflow
          </p>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Agent
          </p>
        </div>

        {ROWS.map((row, i) => (
          <div
            key={row.verb}
            className={`grid min-h-[92px] grid-cols-[200px_1fr_1fr] items-center px-10 py-5 ${
              i < ROWS.length - 1 ? "border-b border-white/5" : ""
            }`}
          >
            <div
              className={`font-mono text-3xl font-semibold tracking-tight ${row.verbClass}`}
            >
              {row.verb}
            </div>
            <div className="text-2xl text-zinc-300">{row.workflow}</div>
            <div className="text-2xl text-zinc-200">{row.agent}</div>
          </div>
        ))}
      </div>

      <p className="text-4xl font-semibold leading-snug tracking-tight text-white">
        One vocabulary.
        <span className="text-zinc-500"> Workflows and agents.</span>
      </p>
    </div>
  );
}
