import { Geist_Mono } from "next/font/google";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400"],
});

const PROPERTIES = [
  {
    label: "STABLE",
    labelClass: "text-sky-400",
    pillAccent: "border-sky-500/30 bg-sky-500/5",
    consequence: "A step can run again without doing the work twice.",
  },
  {
    label: "SUSPENDABLE",
    labelClass: "text-amber-400",
    pillAccent: "border-amber-500/30 bg-amber-500/5",
    consequence: "A run can park until the world catches up.",
  },
  {
    label: "UNDOABLE",
    labelClass: "text-fuchsia-400",
    pillAccent: "border-fuchsia-500/30 bg-fuchsia-500/5",
    consequence: "Side effects can unwind when reality changes.",
  },
] as const;

export default function ThreeVerbsSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-20 p-10 text-center">
      <h2 className="text-7xl font-semibold tracking-tight">
        Reliable software is
      </h2>

      <div className="flex w-full max-w-[1680px] flex-row items-start justify-center gap-6">
        {PROPERTIES.map((p) => (
          <div key={p.label} className="flex flex-1 flex-col items-center gap-6">
            <div
              className={`flex min-w-[420px] items-center justify-center rounded-full border px-10 py-5 ${p.pillAccent} ${geistMono.className}`}
            >
              <span
                className={`text-[38px] font-semibold uppercase leading-none tracking-[0.08em] ${p.labelClass}`}
              >
                {p.label}
              </span>
            </div>
            <p className="max-w-md text-2xl leading-snug text-zinc-400">
              {p.consequence}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
