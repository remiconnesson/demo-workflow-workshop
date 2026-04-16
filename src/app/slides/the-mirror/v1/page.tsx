const CARDS = [
  { verb: "Retry", colorClass: "text-sky-400", desc: "Observer crashed mid-loop — replayed without re-executing" },
  { verb: "Suspend", colorClass: "text-amber-400", desc: "Analyst paused for human approval, then resumed" },
  { verb: "Rollback", colorClass: "text-fuchsia-400", desc: "Agent undid its own decision when the operator said no" },
] as const;

export default function TheMirrorV1() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-12 px-20">
      <h2 className="text-5xl font-semibold tracking-tight text-white">
        The same primitives.
        <span className="text-zinc-500"> Now handed to the AI.</span>
      </h2>
      <div className="grid grid-cols-3 gap-10">
        {CARDS.map((card) => (
          <div key={card.verb} className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-zinc-950 p-10">
            <div className={`font-mono text-4xl font-semibold tracking-tight ${card.colorClass}`}>
              {card.verb}
            </div>
            <div className="text-2xl leading-snug text-zinc-200">
              {card.desc}
            </div>
          </div>
        ))}
      </div>
      <p className="text-4xl font-semibold leading-snug tracking-tight text-white">
        Three verbs.
        <span className="text-zinc-500"> Same verbs. Workflows or agents.</span>
      </p>
    </div>
  );
}
