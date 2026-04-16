import { Geist_Mono } from "next/font/google";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400"],
});

const PRIMITIVES = [
  {
    verb: "RETRY",
    verbClass: "text-sky-400",
    pillAccent: "border-sky-500/30 bg-sky-500/5",
    consequence: "When a step fails, try again without duplicating work.",
  },
  {
    verb: "SUSPEND",
    verbClass: "text-amber-400",
    pillAccent: "border-amber-500/30 bg-amber-500/5",
    consequence: "Pause for hours or days without losing progress.",
  },
  {
    verb: "ROLLBACK",
    verbClass: "text-fuchsia-400",
    pillAccent: "border-fuchsia-500/30 bg-fuchsia-500/5",
    consequence: "When something breaks, undo everything that already happened.",
  },
] as const;

export default function ThreeVerbsSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-20 p-10 text-center">
      <h2 className="text-6xl font-semibold tracking-tight">
        Reliable software must be able to
      </h2>

      <div className="flex w-full max-w-7xl flex-row items-start justify-center gap-10">
        {PRIMITIVES.map((p) => (
          <div key={p.verb} className="flex flex-1 flex-col items-center gap-6">
            <div
              className={`flex items-center justify-center rounded-full border px-12 py-5 ${p.pillAccent} ${geistMono.className}`}
            >
              <span className={`text-4xl font-medium tracking-tight ${p.verbClass}`}>
                {p.verb}
              </span>
            </div>
            <p className="max-w-sm text-xl leading-snug text-zinc-400">
              {p.consequence}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
