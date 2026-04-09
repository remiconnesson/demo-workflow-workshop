import { Kw, Fn, Str, Cmt, Punc } from "../_components/code-tokens";
import { LiveOrderConceptLab } from "../_components/live-order-concept-lab";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function ApprovalGateSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: code */}
      <div className="flex-1 max-w-2xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Approval Gate
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Human in the loop
        </h2>

        <pre className="mt-8 rounded-2xl border border-amber-500/20 bg-zinc-950 p-8 font-mono text-xl leading-relaxed overflow-hidden">
          <Cmt>{"// High-value order needs manager approval"}</Cmt>{"\n"}
          <Kw>const</Kw> hook = <Fn>createHook</Fn><Punc>({"{"}</Punc>{"\n"}
          {"  "}token: <Str>{"`approval:${orderId}`"}</Str>{"\n"}
          <Punc>{"})"}</Punc>{"\n"}
          {"\n"}
          <Cmt>{"// Race: approval vs. 1 hour timeout"}</Cmt>{"\n"}
          <Kw>const</Kw> result = <Kw>await</Kw> Promise.<Fn>race</Fn><Punc>([</Punc>{"\n"}
          {"  "}hook.<Fn>then</Fn><Punc>(</Punc>p <Punc>=&gt;</Punc> <Punc>({"{"}</Punc> kind: <Str>&quot;decision&quot;</Str>, p <Punc>{"})"}</Punc><Punc>)</Punc>,{"\n"}
          {"  "}<Fn>sleep</Fn><Punc>(</Punc><Str>&quot;1h&quot;</Str><Punc>)</Punc>.<Fn>then</Fn><Punc>(</Punc><Punc>()</Punc> <Punc>=&gt;</Punc> <Punc>({"{"}</Punc> kind: <Str>&quot;timeout&quot;</Str> <Punc>{"})"}</Punc><Punc>)</Punc>,{"\n"}
          <Punc>])</Punc>
        </pre>
      </div>

      {/* Right: live hook demo */}
      <div className="flex-1 max-w-md">
        <LiveOrderConceptLab
          slide="approval-gate"
          scenario={slideScenarios.approvalGate}
          highlightSteps={["notifyRestaurant"]}
          showCompensations={false}
          showChips={false}
          maxEvents={4}
        />
      </div>
    </div>
  );
}
