import { Geist_Mono } from "next/font/google";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400"],
});

const CAPABILITIES = [
  {
    verb: "RETRY",
    verbClass: "text-sky-400",
    pillAccent: "border-sky-500/30 bg-sky-500/5",
    promise: "Agents that survive.",
    detail: "Streams reconnect. Tool calls replay from the event log.",
  },
  {
    verb: "SUSPEND",
    verbClass: "text-amber-400",
    pillAccent: "border-amber-500/30 bg-amber-500/5",
    promise: "Agents that wait.",
    detail: "Pause mid-task for a human, then pick up right where you left off.",
  },
  {
    verb: "ROLLBACK",
    verbClass: "text-fuchsia-400",
    pillAccent: "border-fuchsia-500/30 bg-fuchsia-500/5",
    promise: "Agents that undo.",
    detail: "Compensations unwind the loop. Every decision is reversible.",
  },
] as const;

export default function TheMirrorSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-20 p-10 text-center">
      <div className="flex flex-col items-center gap-5">
        <h2 className="text-6xl font-semibold tracking-tight">
          That&apos;s how you build{" "}
          <span className="text-white">reliable agents.</span>
        </h2>
      </div>

      <div className="flex w-full max-w-7xl flex-row items-start justify-center gap-10">
        {CAPABILITIES.map((c) => (
          <div key={c.verb} className="flex flex-1 flex-col items-center gap-6">
            <div
              className={`flex items-center justify-center rounded-full border px-12 py-5 ${c.pillAccent} ${geistMono.className}`}
            >
              <span className={`text-4xl font-medium tracking-tight ${c.verbClass}`}>
                {c.verb}
              </span>
            </div>
            <p className="text-3xl font-semibold tracking-tight text-white">
              {c.promise}
            </p>
            <p className="max-w-xs text-xl leading-snug text-zinc-400">
              {c.detail}
            </p>
          </div>
        ))}
      </div>

      <p className={`text-lg tracking-[0.35em] text-zinc-600 ${geistMono.className}`}>
        ONE SDK &nbsp;·&nbsp; ONE MENTAL MODEL
      </p>
    </div>
  );
}
