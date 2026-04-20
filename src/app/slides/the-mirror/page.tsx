import { Geist_Mono } from "next/font/google";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400"],
});

const TONE = {
  sky: {
    pill: "border-sky-500/35 bg-sky-500/10 text-sky-300",
    card: "border-sky-500/20 bg-sky-500/[0.04]",
    label: "text-sky-300",
  },
  amber: {
    pill: "border-amber-500/35 bg-amber-500/10 text-amber-300",
    card: "border-amber-500/20 bg-amber-500/[0.04]",
    label: "text-amber-300",
  },
  fuchsia: {
    pill: "border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-300",
    card: "border-fuchsia-500/20 bg-fuchsia-500/[0.04]",
    label: "text-fuchsia-300",
  },
} as const;

const MAPPINGS = [
  {
    label: "Stable",
    tone: "sky",
    workflow: "Charge once, even when the step retries.",
    agent: "Tool calls replay without re-executing.",
    detail: "Finished work returns from the event log.",
  },
  {
    label: "Suspendable",
    tone: "amber",
    workflow: "Wait for the restaurant.",
    agent: "Await human approval mid-loop.",
    detail: "The run parks, then resumes at the same line.",
  },
  {
    label: "Undoable",
    tone: "fuchsia",
    workflow: "Unwind a disputed order.",
    agent: "Roll back an applied change.",
    detail: "Compensation is just durable work in reverse.",
  },
] as const;

export default function TheMirrorSlide() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1660px] flex-col justify-center gap-10 px-14 py-16 text-center">
      <div className="flex flex-col items-center gap-5">
        <p
          className={`text-xl uppercase tracking-[0.28em] text-zinc-500 ${geistMono.className}`}
        >
          Same primitives, new surface
        </p>
        <h2 className="text-7xl font-semibold tracking-tight">
          That&apos;s how you build{" "}
          <span className="text-white">reliable agents.</span>
        </h2>
      </div>

      <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/[0.04] px-8 py-6 text-left">
        <div className="flex items-center gap-6">
          <span
            className={`rounded-full border border-emerald-400/35 bg-emerald-500/10 px-5 py-2.5 text-[22px] font-semibold leading-none tracking-tight text-emerald-300 ${geistMono.className}`}
          >
            Foundation
          </span>
          <p className="text-2xl leading-snug text-zinc-300">
            <span className="font-semibold text-white">First Agent</span>{" "}
            proved the run itself can survive: one stream, one run ID, F5 safe.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {MAPPINGS.map((m) => {
          const tone = TONE[m.tone];
          return (
            <section
              key={m.label}
              className={`flex min-h-[360px] flex-col rounded-3xl border p-8 text-left ${tone.card}`}
            >
              <div className="flex items-center justify-between gap-4">
                <span
                  className={`rounded-full border px-5 py-2.5 text-[22px] font-semibold leading-none tracking-tight ${tone.pill} ${geistMono.className}`}
                >
                  {m.label}
                </span>
                <span
                  className={`text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 ${geistMono.className}`}
                >
                  Workflow → Agent
                </span>
              </div>
              <div className="mt-8 flex flex-1 flex-col justify-center gap-6">
                <div>
                  <p
                    className={`text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 ${geistMono.className}`}
                  >
                    Workflow
                  </p>
                  <p className="mt-2 text-3xl font-semibold leading-tight text-white">
                    {m.workflow}
                  </p>
                </div>
                <div className="h-px bg-white/10" />
                <div>
                  <p
                    className={`text-sm font-semibold uppercase tracking-[0.2em] ${tone.label} ${geistMono.className}`}
                  >
                    Agent
                  </p>
                  <p className="mt-2 text-3xl font-semibold leading-tight text-white">
                    {m.agent}
                  </p>
                  <p className="mt-3 text-xl leading-snug text-zinc-400">
                    {m.detail}
                  </p>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <p
        className={`text-lg leading-none tracking-tight text-zinc-500 ${geistMono.className}`}
      >
        One SDK &nbsp;·&nbsp; One mental model
      </p>
    </div>
  );
}
