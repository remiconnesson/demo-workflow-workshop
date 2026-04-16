const PRIMITIVES = [
  {
    verb: "RETRY",
    verbClass: "text-sky-400",
    tileAccent: "border-sky-500/30 bg-sky-500/5",
    consequence: "Transient failures shouldn't reach the customer.",
  },
  {
    verb: "SUSPEND",
    verbClass: "text-amber-400",
    tileAccent: "border-amber-500/30 bg-amber-500/5",
    consequence: "Some steps wait days for a human, a webhook, a signal.",
  },
  {
    verb: "ROLLBACK",
    verbClass: "text-fuchsia-400",
    tileAccent: "border-fuchsia-500/30 bg-fuchsia-500/5",
    consequence: "When step five fails, steps one through four must unwind.",
  },
] as const;

export default function ThreeVerbsSlide() {
  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col justify-center gap-14 px-20">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          The workshop vocabulary
        </p>
        <h2 className="text-7xl font-semibold tracking-tight text-white">
          Three verbs.
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {PRIMITIVES.map((primitive) => (
          <div
            key={primitive.verb}
            className={`flex min-h-[220px] flex-col justify-between rounded-2xl border p-10 ${primitive.tileAccent}`}
          >
            <div
              className={`font-mono text-7xl font-semibold tracking-tight ${primitive.verbClass}`}
            >
              {primitive.verb}
            </div>
            <p className="text-xl leading-snug text-zinc-300">
              {primitive.consequence}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
