import { Kw, Fn, Str, Cmt, Punc } from "../_components/code-tokens";
import { LiveOrderConceptLab } from "../_components/live-order-concept-lab";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function TimeoutRaceSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: code */}
      <div className="flex-1 max-w-xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          From the demo code
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Promise.race + sleep
        </h2>

        <pre className="mt-8 rounded-2xl border border-amber-500/20 bg-zinc-950 p-8 font-mono text-2xl leading-relaxed overflow-hidden">
          <Cmt>{"// driver has 1s for this slide demo"}</Cmt>{"\n"}
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
          If the driver doesn&apos;t accept in time, the workflow times out and triggers compensation.
        </p>
      </div>

      {/* Right: live demo with 1s timeout */}
      <div className="flex-1 max-w-xl">
        <LiveOrderConceptLab
          slide="timeout-race"
          scenario={slideScenarios.timeoutRace}
        />
      </div>
    </div>
  );
}
