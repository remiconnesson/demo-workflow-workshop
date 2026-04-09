import { Kw, Fn, Str, Cmt, Punc } from "../_components/code-tokens";

export default function ErrorsSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: two error types */}
      <div className="flex-1 max-w-xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Error Handling
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          When to give up, when to retry
        </h2>

        <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-lg font-semibold text-red-400">FatalError</span>
            <span className="text-base text-zinc-500">— give up now</span>
          </div>
          <pre className="font-mono text-xl leading-relaxed">
            <Kw>throw new</Kw> <Fn>FatalError</Fn><Punc>(</Punc><Str>&quot;Restaurant not found&quot;</Str><Punc>)</Punc>
          </pre>
          <p className="mt-3 text-lg text-zinc-400">
            Skip retries. Start compensating immediately.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-lg font-semibold text-amber-400">RetryableError</span>
            <span className="text-base text-zinc-500">— try again later</span>
          </div>
          <pre className="font-mono text-xl leading-relaxed">
            <Kw>throw new</Kw> <Fn>RetryableError</Fn><Punc>(</Punc><Str>&quot;Rate limited&quot;</Str>, <Punc>{"{"}</Punc>{"\n"}
            {"  "}retryAfter: <Str>&quot;1m&quot;</Str>{"\n"}
            <Punc>{"})"}</Punc>
          </pre>
          <p className="mt-3 text-lg text-zinc-400">
            The service is probably just busy. Back off and retry.
          </p>
        </div>
      </div>

      {/* Right: retry timeline */}
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
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-lg font-semibold ${r.color}`}>
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
                        wait {r.delay} then retry
                      </div>
                    )}
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div className="ml-5 h-6 w-[2px] bg-white/10" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-black p-4">
            <pre className="font-mono text-base text-zinc-300">
              <Kw>const</Kw> <Punc>{"{"}</Punc> attempt <Punc>{"}"}</Punc> = <Fn>getStepMetadata</Fn><Punc>()</Punc>{"\n"}
              <Kw>const</Kw> backoff = attempt ** 2 * 1000
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
