import { Kw, Fn, Str, Cmt, Punc } from "../_components/code-tokens";

export default function ErrorsRetrySlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: retry code */}
      <div className="flex-1 max-w-2xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Retry Semantics
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Exponential backoff for free
        </h2>

        <pre className="mt-8 rounded-2xl border border-white/10 bg-zinc-950 p-8 font-mono text-xl leading-relaxed overflow-hidden">
          <Kw>async function</Kw> <Fn>callDeliveryAPI</Fn><Punc>(</Punc>order<Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
          {"  "}<span className="text-emerald-400 font-semibold">&quot;use step&quot;</span>{"\n"}
          {"\n"}
          {"  "}<Kw>const</Kw> <Punc>{"{"}</Punc> attempt <Punc>{"}"}</Punc> = <Fn>getStepMetadata</Fn><Punc>()</Punc>{"\n"}
          {"  "}<Kw>const</Kw> backoff = attempt ** <span className="text-white">2</span> * <span className="text-white">1000</span>{"\n"}
          {"\n"}
          {"  "}<Kw>const</Kw> res = <Kw>await</Kw> <Fn>fetch</Fn><Punc>(</Punc>url<Punc>)</Punc>{"\n"}
          {"\n"}
          {"  "}<Kw>if</Kw> <Punc>(</Punc>res.status === <span className="text-white">429</span><Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
          {"    "}<Kw>throw new</Kw> <Fn>RetryableError</Fn><Punc>(</Punc>{"\n"}
          {"      "}<Str>&quot;Rate limited&quot;</Str>,{"\n"}
          {"      "}<Punc>{"{"}</Punc> retryAfter: backoff <Punc>{"}"}</Punc>{"\n"}
          {"    "}<Punc>)</Punc>{"\n"}
          {"  "}<Punc>{"}"}</Punc>{"\n"}
          <Punc>{"}"}</Punc>
        </pre>
      </div>

      {/* Right: visual retry timeline */}
      <div className="flex-1 max-w-md">
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Retry Timeline
          </div>

          <div className="mt-6 flex flex-col gap-0">
            {[
              { attempt: 1, delay: "0s", status: "429", color: "border-amber-400 text-amber-300" },
              { attempt: 2, delay: "1s", status: "429", color: "border-amber-400 text-amber-300" },
              { attempt: 3, delay: "4s", status: "429", color: "border-amber-400 text-amber-300" },
              { attempt: 4, delay: "9s", status: "200", color: "border-emerald-400 text-emerald-300" },
            ].map((r, i, arr) => (
              <div key={r.attempt}>
                <div className="flex items-center gap-5">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-lg font-semibold ${r.color}`}>
                    {r.attempt}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-lg text-zinc-300">attempt {r.attempt}</span>
                      <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${
                        r.status === "200"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}>
                        {r.status}
                      </span>
                    </div>
                    {r.status !== "200" && (
                      <div className="mt-1 font-mono text-sm text-zinc-500">
                        retryAfter: {r.delay} (attempt^2 * 1000ms)
                      </div>
                    )}
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div className="ml-6 h-8 w-[2px] bg-white/10" />
                )}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
