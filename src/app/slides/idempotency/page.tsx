import { Kw, Dir, Fn, Cmt, Punc } from "../_components/code-tokens";
import { IdempotencyLab } from "../_components/foundations/idempotency-lab";

export default function IdempotencySlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: code sample */}
      <div className="flex-1 max-w-xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Idempotency
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Stable step IDs make retries safe
        </h2>

        <pre className="mt-8 rounded-2xl border border-white/10 bg-zinc-950 p-8 font-mono text-xl leading-relaxed overflow-hidden">
          <Kw>async function</Kw> <Fn>chargePayment</Fn><Punc>(</Punc>input<Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
          {"  "}<Dir>&quot;use step&quot;</Dir>{"\n"}
          {"\n"}
          {"  "}<Kw>const</Kw> <Punc>{"{"}</Punc> stepId <Punc>{"}"}</Punc> = <Fn>getStepMetadata</Fn><Punc>()</Punc>{"\n"}
          {"\n"}
          {"  "}<Kw>const</Kw> charge = <Kw>await</Kw> stripe.charges.<Fn>create</Fn><Punc>({"{"}</Punc>{"\n"}
          {"    "}amount: input.total,{"\n"}
          {"    "}idempotencyKey: stepId, <Cmt>{"// same key on every retry"}</Cmt>{"\n"}
          {"  "}<Punc>{"})"}</Punc>{"\n"}
          {"\n"}
          {"  "}<Kw>return</Kw> charge.id{"\n"}
          <Punc>{"}"}</Punc>
        </pre>
      </div>

      {/* Right: interactive lab */}
      <div className="flex-1 max-w-xl">
        <IdempotencyLab />
      </div>
    </div>
  );
}
