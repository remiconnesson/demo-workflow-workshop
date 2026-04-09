import { Kw, Dir, Fn, Punc } from "../_components/code-tokens";
import { LiveOrderConceptLab } from "../_components/live-order-concept-lab";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function StreamingSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: code */}
      <div className="flex-1 max-w-xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          From the demo code
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Watch it happen in real time
        </h2>

        <pre className="mt-10 rounded-2xl border border-white/10 bg-zinc-950 p-10 font-mono text-2xl leading-relaxed overflow-hidden">
          <Kw>async function</Kw> <Fn>emit</Fn><Punc>(</Punc>event<Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
          {"  "}<Dir>&quot;use step&quot;</Dir>{"\n"}
          {"\n"}
          {"  "}<Kw>const</Kw> writer = <Fn>getWritable</Fn><Punc>()</Punc>.<Fn>getWriter</Fn><Punc>()</Punc>{"\n"}
          {"  "}<Kw>await</Kw> writer.<Fn>write</Fn><Punc>(</Punc>event<Punc>)</Punc>{"\n"}
          {"  "}writer.<Fn>releaseLock</Fn><Punc>()</Punc>{"\n"}
          <Punc>{"}"}</Punc>
        </pre>

        <p className="mt-6 text-xl text-zinc-400">
          NDJSON over HTTP. Every step emits structured events via{" "}
          <span className="font-mono text-white">getWritable()</span>.
        </p>
      </div>

      {/* Right: live event feed */}
      <div className="flex-1 max-w-xl">
        <LiveOrderConceptLab
          slide="streaming"
          scenario={slideScenarios.streaming}
        />
      </div>
    </div>
  );
}
