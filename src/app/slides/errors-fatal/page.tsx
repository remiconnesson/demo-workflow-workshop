import { Kw, Fn, Str, Cmt, Punc, Typ } from "../_components/code-tokens";

export default function ErrorsFatalSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: FatalError */}
      <div className="flex-1 max-w-xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Error Handling
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Two kinds of failure
        </h2>

        <div className="mt-10 rounded-2xl border border-red-500/20 bg-red-500/5 p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
              FatalError
            </span>
          </div>
          <pre className="font-mono text-xl leading-relaxed">
            <Kw>if</Kw> <Punc>(</Punc>response.status === <span className="text-white">404</span><Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
            {"  "}<Kw>throw new</Kw> <Fn>FatalError</Fn><Punc>(</Punc>{"\n"}
            {"    "}<Str>&quot;Restaurant not found&quot;</Str>{"\n"}
            {"  "}<Punc>)</Punc>{"\n"}
            <Punc>{"}"}</Punc>
          </pre>
          <p className="mt-4 text-lg text-zinc-400">
            Permanent failure. <span className="text-red-400">Skip all retries.</span> Trigger compensation immediately.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
              RetryableError
            </span>
          </div>
          <pre className="font-mono text-xl leading-relaxed">
            <Kw>if</Kw> <Punc>(</Punc>response.status === <span className="text-white">429</span><Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
            {"  "}<Kw>throw new</Kw> <Fn>RetryableError</Fn><Punc>(</Punc>{"\n"}
            {"    "}<Str>&quot;Rate limited&quot;</Str>,{"\n"}
            {"    "}<Punc>{"{"}</Punc> retryAfter: <Str>&quot;1m&quot;</Str> <Punc>{"}"}</Punc>{"\n"}
            {"  "}<Punc>)</Punc>{"\n"}
            <Punc>{"}"}</Punc>
          </pre>
          <p className="mt-4 text-lg text-zinc-400">
            Transient failure. <span className="text-amber-400">Retry after a delay.</span> Custom backoff per error.
          </p>
        </div>
      </div>

      {/* Right: the demo's failure dropdown */}
      <div className="flex-1 max-w-md">
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            In the demo
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">
            Simulate failure
          </h3>
          <div className="mt-6 flex flex-col gap-2">
            {[
              { step: "null", label: "happy path", color: "bg-emerald-500" },
              { step: "validateOrder", label: "force failure", color: "bg-red-500/70" },
              { step: "chargePayment", label: "force failure", color: "bg-red-500/70" },
              { step: "notifyRestaurant", label: "force failure", color: "bg-red-500/70" },
              { step: "assignDriver", label: "force failure", color: "bg-red-500/70" },
            ].map((opt) => (
              <div key={opt.step} className="flex items-center gap-4 rounded-xl border border-white/10 bg-black px-5 py-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${opt.color}`} />
                <span className="font-mono text-lg text-zinc-300">{opt.step}</span>
                <span className="text-sm text-zinc-500">{opt.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
