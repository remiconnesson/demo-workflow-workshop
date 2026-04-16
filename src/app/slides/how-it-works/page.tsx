const BEATS = [
  {
    number: "1",
    label: "Demo",
    description: "See the problem play out live.",
    accent: "border-sky-500/40 bg-sky-500/5",
    numberColor: "text-sky-400",
  },
  {
    number: "2",
    label: "Solution",
    description: "Fix it with a few lines of code.",
    accent: "border-emerald-400/40 bg-emerald-400/5",
    numberColor: "text-emerald-300",
  },
  {
    number: "3",
    label: "Pattern",
    description: "Understand the pattern behind it.",
    accent: "border-white/20 bg-white/5",
    numberColor: "text-zinc-300",
  },
];

export default function HowItWorksSlide() {
  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-center gap-16 px-20">
      <h2 className="text-5xl font-semibold tracking-tight">
        This presentation is divided into groups of 3 slides
      </h2>

      <div className="grid grid-cols-3 gap-6">
        {BEATS.map((beat) => (
          <div
            key={beat.label}
            className={`flex flex-col gap-5 rounded-2xl border p-8 ${beat.accent}`}
          >
            <span className={`font-mono text-2xl ${beat.numberColor}`}>
              {beat.number}
            </span>
            <p className="text-3xl font-semibold tracking-tight text-white">
              {beat.label}
            </p>
            <p className="text-xl leading-snug text-zinc-400">
              {beat.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
