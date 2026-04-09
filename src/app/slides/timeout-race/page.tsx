import { Kw, Fn, Str, Cmt, Punc } from "../_components/code-tokens";

export default function TimeoutRaceSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: code */}
      <div className="flex-1 max-w-2xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Timeout Pattern
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Promise.race + sleep
        </h2>

        <pre className="mt-8 rounded-2xl border border-amber-500/20 bg-zinc-950 p-8 font-mono text-2xl leading-relaxed overflow-hidden">
          <Cmt>{"// From the demo: driver has 2 minutes"}</Cmt>{"\n"}
          <Kw>const</Kw> result = <Kw>await</Kw> Promise.<Fn>race</Fn><Punc>([</Punc>{"\n"}
          {"  "}driverHook.<Fn>then</Fn><Punc>(</Punc>r <Punc>=&gt;</Punc> <Punc>({"{"}</Punc>{"\n"}
          {"    "}kind: <Str>&quot;resolved&quot;</Str>, r{"\n"}
          {"  "}<Punc>{"})"}</Punc><Punc>)</Punc>,{"\n"}
          {"  "}<Fn>sleep</Fn><Punc>(</Punc><Str>&quot;2m&quot;</Str><Punc>)</Punc>.<Fn>then</Fn><Punc>(</Punc><Punc>()</Punc> <Punc>=&gt;</Punc> <Punc>({"{"}</Punc>{"\n"}
          {"    "}kind: <Str>&quot;timeout&quot;</Str>{"\n"}
          {"  "}<Punc>{"})"}</Punc><Punc>)</Punc>,{"\n"}
          <Punc>])</Punc>
        </pre>

        <p className="mt-6 text-xl text-zinc-400">
          This is the actual code from <span className="font-mono text-white">place-order.ts</span>.
          If the driver doesn&apos;t accept in 2 minutes, the workflow times out and triggers compensation.
        </p>
      </div>

      {/* Right: visual race */}
      <div className="flex-1 max-w-md">
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Two outcomes
          </div>

          <div className="mt-8 flex flex-col gap-6">
            {/* Happy path */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
              <div className="flex items-center gap-4">
                <span className="h-4 w-4 rounded-full bg-emerald-400" />
                <span className="text-xl font-semibold text-emerald-300">Driver accepts (45s)</span>
              </div>
              <div className="mt-3 font-mono text-base text-zinc-400">
                kind: &quot;resolved&quot; &rarr; continue saga
              </div>
              <div className="mt-2 text-base text-zinc-500">
                sleep(&quot;2m&quot;) is cancelled automatically
              </div>
            </div>

            {/* middle divider */}
            <div className="flex items-center gap-4">
              <div className="h-[2px] flex-1 bg-white/10" />
              <span className="text-zinc-600 text-lg font-mono">OR</span>
              <div className="h-[2px] flex-1 bg-white/10" />
            </div>

            {/* Timeout path */}
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
              <div className="flex items-center gap-4">
                <span className="h-4 w-4 rounded-full bg-red-400" />
                <span className="text-xl font-semibold text-red-300">Timeout (2m)</span>
              </div>
              <div className="mt-3 font-mono text-base text-zinc-400">
                kind: &quot;timeout&quot; &rarr; throw FatalError
              </div>
              <div className="mt-2 text-base text-zinc-500">
                Compensation stack unwinds: refund, cancel restaurant
              </div>
            </div>
          </div>

          <p className="mt-6 text-base text-zinc-500">
            <span className="font-mono text-amber-300">sleep(&quot;2m&quot;)</span> is
            durable — the workflow suspends with zero cost. No running timer, no container.
          </p>
        </div>
      </div>
    </div>
  );
}
