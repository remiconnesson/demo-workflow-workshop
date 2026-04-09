import { Kw, Fn, Cmt, Punc } from "../_components/code-tokens";
import { LiveOrderConceptLab } from "../_components/live-order-concept-lab";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function SagaSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: code */}
      <div className="flex-1 max-w-lg">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Saga Pattern
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Fail forward, unwind backward
        </h2>

        <pre className="mt-8 rounded-2xl border border-fuchsia-500/20 bg-zinc-950 p-8 font-mono text-xl leading-relaxed overflow-hidden">
          <Cmt>{"// after each step, push its undo"}</Cmt>{"\n"}
          <Kw>const</Kw> payment = <Kw>await</Kw> <Fn>chargePayment</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
          compensations.<Fn>push</Fn><Punc>({"{"}</Punc>{"\n"}
          {"  "}action: <span className="text-amber-300">&quot;refundPayment&quot;</span>,{"\n"}
          {"  "}undo: <Punc>()</Punc> <Punc>=&gt;</Punc> <Fn>refundPayment</Fn><Punc>(</Punc>id, payment<Punc>)</Punc>{"\n"}
          <Punc>{"})"}</Punc>{"\n"}
          {"\n"}
          <Cmt>{"// on failure: unwind in reverse"}</Cmt>{"\n"}
          <Kw>while</Kw> <Punc>(</Punc>compensations.length &gt; 0<Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
          {"  "}<Kw>const</Kw> c = compensations.<Fn>pop</Fn><Punc>()</Punc>{"\n"}
          {"  "}<Kw>await</Kw> c.<Fn>undo</Fn><Punc>()</Punc>{"\n"}
          <Punc>{"}"}</Punc>
        </pre>
      </div>

      {/* Right: live rollback demo */}
      <div className="flex-1 max-w-2xl">
        <LiveOrderConceptLab
          slide="saga"
          scenario={slideScenarios.saga}
        />
      </div>
    </div>
  );
}
