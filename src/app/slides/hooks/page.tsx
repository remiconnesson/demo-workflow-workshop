import { Kw, Fn, Str, Cmt, Punc, Typ } from "../_components/code-tokens";
import { LiveOrderConceptLab } from "../_components/live-order-concept-lab";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function HooksSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: code */}
      <div className="flex-1 max-w-xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Hooks
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Pause. Wait. Resume.
        </h2>

        <pre className="mt-10 rounded-2xl border border-white/10 bg-zinc-950 p-8 font-mono text-xl leading-relaxed overflow-hidden">
          <Kw>using</Kw> hook = <Fn>createHook</Fn><Punc>&lt;</Punc><Typ>{"{ accepted: boolean }"}</Typ><Punc>&gt;({"{"}</Punc>{"\n"}
          {"  "}token: <Str>{"`order:${orderId}:restaurant-accept`"}</Str>{"\n"}
          <Punc>{"})"}</Punc>{"\n"}
          {"\n"}
          <Cmt>{"// workflow suspends \u2014 zero compute cost"}</Cmt>{"\n"}
          <Kw>const</Kw> result = <Kw>await</Kw> hook{"\n"}
          {"\n"}
          <Kw>if</Kw> <Punc>(</Punc>!result.accepted<Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
          {"  "}<Kw>throw new</Kw> <Fn>FatalError</Fn><Punc>(</Punc><Str>&quot;Rejected&quot;</Str><Punc>)</Punc>{"\n"}
          <Punc>{"}"}</Punc>
        </pre>
      </div>

      {/* Right: live hook demo */}
      <div className="flex-1 max-w-xl">
        <LiveOrderConceptLab
          slide="hooks"
          scenario={slideScenarios.hooks}
        />
      </div>
    </div>
  );
}
