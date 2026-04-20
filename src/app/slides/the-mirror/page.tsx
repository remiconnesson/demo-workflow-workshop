import { Geist_Mono } from "next/font/google";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400"],
});

const PROPERTIES = [
  {
    label: "Stable",
    labelClass: "text-sky-400",
    pillAccent: "border-sky-500/30 bg-sky-500/5",
    consequence: "Tool calls replay without re-executing.",
  },
  {
    label: "Suspendable",
    labelClass: "text-amber-400",
    pillAccent: "border-amber-500/30 bg-amber-500/5",
    consequence: "Await human approval mid-loop.",
  },
  {
    label: "Undoable",
    labelClass: "text-fuchsia-400",
    pillAccent: "border-fuchsia-500/30 bg-fuchsia-500/5",
    consequence: "Roll back an applied change.",
  },
] as const;

export default function TheMirrorSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-20 p-10 text-center">
      <h2 className="text-7xl font-semibold tracking-tight">
        Reliable agents are
      </h2>

      <div className="flex w-full max-w-[1680px] flex-row items-start justify-center gap-6">
        {PROPERTIES.map((p) => (
          <div key={p.label} className="flex flex-1 flex-col items-center gap-6">
            <div
              className={`flex min-w-[360px] items-center justify-center rounded-full border px-7 py-3.5 ${p.pillAccent} ${geistMono.className}`}
            >
              <span
                className={`text-[44px] font-semibold leading-none tracking-tight ${p.labelClass}`}
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

      <p
        className={`text-lg leading-none tracking-tight text-zinc-500 ${geistMono.className}`}
      >
        One SDK &nbsp;·&nbsp; One mental model
      </p>
    </div>
  );
}
