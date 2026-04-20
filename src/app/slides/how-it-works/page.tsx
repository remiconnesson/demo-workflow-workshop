import { Fragment } from "react";

const BEATS = [
  {
    formal: "Demo",
    title: "Break",
    promise: "Watch the failure happen.",
    visual: (
      <div className="flex h-[220px] items-center justify-center gap-7 rounded-2xl border border-white/10 bg-black/35 p-6">
        <div className="flex h-48 w-28 flex-col items-center justify-center rounded-[28px] border border-white/10 bg-zinc-900 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
          <div className="mb-4 h-2 w-12 rounded-full bg-zinc-700" />
          <div className="h-3 w-14 rounded bg-zinc-700" />
          <div className="mt-3 h-3 w-11 rounded bg-zinc-700/70" />
          <div className="mt-3 h-3 w-14 rounded bg-red-500/50" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded-full bg-emerald-400/70" />
            <div className="h-2.5 w-20 rounded bg-zinc-700" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded-full bg-emerald-400/70" />
            <div className="h-2.5 w-16 rounded bg-zinc-700" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded-full bg-red-400 shadow-[0_0_22px_rgba(248,113,113,0.45)]" />
            <div className="h-2.5 w-24 rounded bg-red-500/35" />
          </div>
        </div>
      </div>
    ),
  },
  {
    formal: "Code",
    title: "Fix",
    promise: "See the durable change.",
    visual: (
      <div className="h-[220px] overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-5 font-mono">
        <div className="mb-5 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-400/50" />
          <span className="h-3 w-3 rounded-full bg-amber-400/50" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/50" />
          <span className="ml-3 text-sm text-zinc-600">placeOrder.ts</span>
        </div>
        <div className="space-y-3 text-lg leading-none">
          <div className="flex items-center gap-4 text-zinc-600">
            <span className="w-5 text-right text-zinc-700">1</span>
            <span>
              <span className="text-fuchsia-400/65">async function</span>{" "}
              <span className="text-zinc-300">placeOrder</span>
              <span className="text-zinc-600">() {"{"}</span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-zinc-600">
            <span className="w-5 text-right text-zinc-700">2</span>
            <span className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-emerald-300">
              &quot;use workflow&quot;
            </span>
          </div>
          <div className="flex items-center gap-4 text-zinc-600">
            <span className="w-5 text-right text-zinc-700">3</span>
            <span className="pl-6 text-zinc-500">await chargeCard(order)</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-600">
            <span className="w-5 text-right text-zinc-700">4</span>
            <span className="pl-6 text-emerald-300/80">// durable now</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    formal: "Pattern",
    title: "Name",
    promise: "Leave with the pattern.",
    visual: (
      <div className="flex h-[220px] flex-col justify-center rounded-2xl border border-white/10 bg-black/35 p-7">
        <p className="font-mono text-base font-semibold uppercase tracking-[0.22em] text-zinc-600">
          Reusable idea
        </p>
        <p className="mt-4 text-4xl font-semibold tracking-tight text-white">
          Idempotency
        </p>
        <p className="mt-4 text-xl leading-snug text-zinc-500">
          A stable key turns retries into one safe side effect.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <span className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 font-mono text-base text-emerald-300">
            stepId
          </span>
          <span className="h-px flex-1 bg-white/10" />
          <span className="font-mono text-base text-zinc-600">docs →</span>
        </div>
      </div>
    ),
  },
] as const;

export default function HowItWorksSlide() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1560px] flex-col justify-center gap-14 px-16 py-20">
      <div className="flex flex-col gap-4">
        <h2 className="max-w-6xl text-6xl font-semibold leading-[1.05] tracking-tight">
          For each property:
          <span className="text-zinc-500"> break it, fix it, name it.</span>
        </h2>
        <p className="max-w-5xl text-3xl leading-snug text-zinc-400">
          Every demo asks: what do you need from the system now?
        </p>
      </div>

      <div className="flex items-stretch gap-5">
        {BEATS.map((beat, index) => (
          <Fragment key={beat.title}>
            <section className="flex min-h-[560px] w-0 flex-1 flex-col justify-between gap-8 rounded-3xl border border-white/10 bg-zinc-950 p-9 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <div>
                <p className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 font-mono text-base font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  {beat.formal}
                </p>
                <h3 className="mt-6 text-[64px] font-semibold leading-none tracking-tight text-white">
                  {beat.title}
                </h3>
              </div>
              {beat.visual}
              <p className="text-3xl font-medium leading-snug text-zinc-300">
                {beat.promise}
              </p>
            </section>
            {index < BEATS.length - 1 ? (
              <div
                aria-hidden
                className="flex shrink-0 items-center justify-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-600">
                  <svg
                    width="34"
                    height="34"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M5 12h14m0 0-5-5m5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
