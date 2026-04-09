import { Kw, Fn, Str, Cmt, Punc, Dir } from "../_components/code-tokens";

export default function SerializationSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: the trap */}
      <div className="flex-1 max-w-xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Serialization
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Pass by value, not reference
        </h2>

        <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
              The trap
            </span>
          </div>
          <pre className="font-mono text-xl leading-relaxed">
            <Kw>let</Kw> order = <Punc>{"{"}</Punc> status: <Str>&quot;pending&quot;</Str> <Punc>{"}"}</Punc>{"\n"}
            {"\n"}
            <Kw>await</Kw> <Fn>updateStatus</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
            <Cmt>{"// order.status is still \"pending\"!"}</Cmt>{"\n"}
            <Cmt>{"// The step got a COPY, not a reference"}</Cmt>
          </pre>
        </div>

        <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
              The fix
            </span>
          </div>
          <pre className="font-mono text-xl leading-relaxed">
            order = <Kw>await</Kw> <Fn>updateStatus</Fn><Punc>(</Punc>order<Punc>)</Punc>{"\n"}
            <Cmt>{"// Re-assign the return value"}</Cmt>{"\n"}
            <Cmt>{"// order.status is now \"confirmed\""}</Cmt>
          </pre>
        </div>
      </div>

      {/* Right: why this matters */}
      <div className="flex-1 max-w-lg">
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Why it works this way
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">
            Serialization boundary
          </h3>

          <div className="mt-6 flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-semibold text-emerald-400">
                W
              </div>
              <div>
                <div className="text-lg font-semibold">Workflow context</div>
                <div className="text-base text-zinc-400">Deterministic sandbox. Orchestrates.</div>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-sm text-zinc-400">
                <span>&darr;</span> serialize <span>&darr;</span>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sm font-semibold text-sky-400">
                S
              </div>
              <div>
                <div className="text-lg font-semibold">Step context</div>
                <div className="text-base text-zinc-400">Full Node.js. Does I/O. Gets a copy.</div>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-sm text-zinc-400">
                <span>&uarr;</span> deserialize <span>&uarr;</span>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-semibold text-emerald-400">
                W
              </div>
              <div>
                <div className="text-lg font-semibold">Workflow continues</div>
                <div className="text-base text-zinc-400">With the returned value, not the original.</div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-black p-4">
            <div className="text-sm font-semibold text-zinc-500 mb-2">Built-in serializable types</div>
            <div className="flex flex-wrap gap-2 font-mono text-sm">
              {["Date", "Map", "Set", "URL", "RegExp", "BigInt", "Request", "Response", "ReadableStream"].map((t) => (
                <span key={t} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-300">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
