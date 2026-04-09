import { Kw, Fn, Str, Punc } from "../_components/code-tokens";
import { ErrorsLab } from "../_components/foundations/errors-lab";

export default function ErrorsSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: three error types */}
      <div className="flex-1 max-w-xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Error Handling
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          When to give up, when to retry
        </h2>

        <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950 p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-3 w-3 rounded-full bg-sky-500" />
            <span className="text-lg font-semibold text-sky-400">Uncaught Error</span>
            <span className="text-base text-zinc-500">&mdash; retried by default</span>
          </div>
          <pre className="font-mono text-xl leading-relaxed">
            <Kw>throw new</Kw> <Fn>Error</Fn><Punc>(</Punc><Str>&quot;Network timeout&quot;</Str><Punc>)</Punc>
          </pre>
        </div>

        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-lg font-semibold text-red-400">FatalError</span>
            <span className="text-base text-zinc-500">&mdash; stop retrying</span>
          </div>
          <pre className="font-mono text-xl leading-relaxed">
            <Kw>throw new</Kw> <Fn>FatalError</Fn><Punc>(</Punc><Str>&quot;Card declined&quot;</Str><Punc>)</Punc>
          </pre>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-lg font-semibold text-amber-400">RetryableError</span>
            <span className="text-base text-zinc-500">&mdash; you choose retryAfter</span>
          </div>
          <pre className="font-mono text-xl leading-relaxed">
            <Kw>throw new</Kw> <Fn>RetryableError</Fn><Punc>(</Punc><Str>&quot;Rate limited&quot;</Str>, <Punc>{"{"}</Punc>{"\n"}
            {"  "}retryAfter: <Str>&quot;2s&quot;</Str>{"\n"}
            <Punc>{"})"}</Punc>
          </pre>
        </div>
      </div>

      {/* Right: interactive errors lab */}
      <div className="flex-1 max-w-xl">
        <ErrorsLab />
      </div>
    </div>
  );
}
