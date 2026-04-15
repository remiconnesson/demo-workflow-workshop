const BEATS = [
  {
    label: "Demo",
    tagline: "Define the Problem",
    description: "The lab runs. The failure happens live on the phone.",
    accent: "border-red-500/40 bg-red-500/5",
    numberColor: "text-red-400",
    taglineColor: "text-red-200",
  },
  {
    label: "Naive",
    tagline: "Show the Challenge",
    description: "The glue code you'd write without the SDK. Tables, workers, coordinators.",
    accent: "border-amber-400/40 bg-amber-400/5",
    numberColor: "text-amber-300",
    taglineColor: "text-amber-200",
  },
  {
    label: "Workflow SDK",
    tagline: "Workflow SDK Solution",
    description: "The Workflow SDK version. One file. A handful of lines.",
    accent: "border-emerald-400/40 bg-emerald-400/5",
    numberColor: "text-emerald-300",
    taglineColor: "text-emerald-200",
  },
  {
    label: "Pattern",
    tagline: "Explore with your Agent",
    description: "The SDK vocabulary plus the cookbook URL to take home.",
    accent: "border-white/20 bg-white/5",
    numberColor: "text-zinc-300",
    taglineColor: "text-zinc-200",
  },
];

export default function HowItWorksSlide() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-16 px-20">
      <div className="flex flex-col gap-4">
        <h2 className="text-6xl font-semibold tracking-tight">
          Workshop Structure{" "}

        </h2>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {BEATS.map((beat, i) => (
          <div
            key={beat.label}
            className={`flex flex-col gap-5 rounded-2xl border p-8 ${beat.accent}`}
          >
            <span
              className={`font-mono text-2xl ${beat.numberColor}`}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                {beat.label}
              </p>
              <p className={`text-3xl font-semibold tracking-tight ${beat.taglineColor}`}>
                {beat.tagline}
              </p>
            </div>
            <p className="text-xl leading-snug text-zinc-400">
              {beat.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
