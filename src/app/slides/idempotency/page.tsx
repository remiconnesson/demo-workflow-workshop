import { Kw, Dir, Fn, Str, Cmt, Punc } from "../_components/code-tokens";

export default function IdempotencySlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 px-20">
      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Idempotency
      </div>
      <h2 className="text-5xl font-semibold tracking-tight">
        Every step runs exactly once
      </h2>

      <pre className="mt-6 rounded-2xl border border-white/10 bg-zinc-950 p-10 font-mono text-2xl leading-relaxed max-w-4xl w-full">
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

      <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950 p-8 max-w-4xl w-full">
        <div className="flex items-start gap-6">
          <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-emerald-500" />
          <div>
            <p className="text-xl text-zinc-300">
              The runtime assigns a <span className="font-mono text-sky-300">deterministic stepId</span> per
              step. Use it as your external idempotency key.
            </p>
            <p className="mt-3 text-xl text-zinc-500">
              Retries hit the same key &mdash; Stripe deduplicates. The customer is never double-charged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
