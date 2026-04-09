import { Kw, Fn, Str, Cmt, Punc, Typ } from "../_components/code-tokens";

export default function HooksSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: code */}
      <div className="flex-1 max-w-2xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Hooks
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Pause. Wait. Resume.
        </h2>

        <pre className="mt-10 rounded-2xl border border-white/10 bg-zinc-950 p-10 font-mono text-2xl leading-relaxed overflow-hidden">
          <Kw>using</Kw> hook = <Fn>createHook</Fn><Punc>&lt;</Punc><Typ>{"{ accepted: boolean }"}</Typ><Punc>&gt;({"{"}</Punc>{"\n"}
          {"  "}token: <Str>{"`order:${orderId}:restaurant-accept`"}</Str>{"\n"}
          <Punc>{"})"}</Punc>{"\n"}
          {"\n"}
          <Cmt>{"// workflow suspends \u2014 zero compute cost"}</Cmt>{"\n"}
          <Kw>const</Kw> result = <Kw>await</Kw> hook{"\n"}
          {"\n"}
          <Kw>if</Kw> <Punc>(</Punc>!result.accepted<Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
          {"  "}<Kw>throw new</Kw> <Fn>FatalError</Fn><Punc>(</Punc><Str>&quot;Rejected&quot;</Str><Punc>)</Punc>{"\n"}
          <Punc>{"}"}</Punc>
        </pre>
      </div>

      {/* Right: state diagram */}
      <div className="flex-1 max-w-lg flex flex-col gap-0">
        {/* Running */}
        <div className="flex items-center gap-6 rounded-2xl border border-sky-400/30 bg-sky-400/5 p-8">
          <span className="h-5 w-5 shrink-0 rounded-full bg-sky-400" />
          <div>
            <div className="text-2xl font-semibold text-sky-300">Running</div>
            <div className="mt-1 text-lg text-zinc-400">
              <span className="font-mono">createHook()</span> called
            </div>
          </div>
        </div>

        {/* Connector */}
        <div className="ml-10 h-10 w-[2px] bg-white/10" />

        {/* Suspended */}
        <div className="flex items-center gap-6 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-8">
          <span className="h-5 w-5 shrink-0 rounded-full bg-amber-400 animate-pulse" />
          <div>
            <div className="text-2xl font-semibold text-amber-300">Suspended</div>
            <div className="mt-1 text-lg text-zinc-400">
              Zero compute cost. Waiting for external signal.
            </div>
          </div>
        </div>

        {/* Connector */}
        <div className="ml-10 h-10 w-[2px] bg-white/10" />

        {/* Resumed */}
        <div className="flex items-center gap-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-8">
          <span className="h-5 w-5 shrink-0 rounded-full bg-emerald-400" />
          <div>
            <div className="text-2xl font-semibold text-emerald-300">Resumed</div>
            <div className="mt-1 text-lg text-zinc-400">
              <span className="font-mono">POST /resume</span> &rarr; workflow continues
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
