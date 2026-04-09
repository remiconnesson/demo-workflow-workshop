import { Kw, Fn, Str, Cmt, Punc } from "../_components/code-tokens";

export default function SleepSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 px-20">
      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Durable Sleep
      </div>
      <h2 className="text-5xl font-semibold tracking-tight">
        Wait for days — pay for nothing
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-10 w-full max-w-5xl">
        {/* Left: traditional */}
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
              Traditional
            </span>
          </div>
          <pre className="font-mono text-xl leading-relaxed">
            <Cmt>{"// setTimeout? Dead on restart."}</Cmt>{"\n"}
            <Cmt>{"// Cron job? Extra infrastructure."}</Cmt>{"\n"}
            <Cmt>{"// SQS delay? 15 min max."}</Cmt>{"\n"}
            <Cmt>{"// Database polling? Wasteful."}</Cmt>
          </pre>
          <div className="mt-4 flex flex-col gap-2 text-lg text-zinc-400">
            <div className="flex items-center gap-3">
              <span className="text-red-400">&#x2717;</span> Server must stay running
            </div>
            <div className="flex items-center gap-3">
              <span className="text-red-400">&#x2717;</span> State lost on restart
            </div>
            <div className="flex items-center gap-3">
              <span className="text-red-400">&#x2717;</span> Extra infrastructure to manage
            </div>
          </div>
        </div>

        {/* Right: workflow sleep */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
              Workflow SDK
            </span>
          </div>
          <pre className="font-mono text-xl leading-relaxed">
            <Kw>await</Kw> <Fn>sleep</Fn><Punc>(</Punc><Str>&quot;7d&quot;</Str><Punc>)</Punc>{"\n"}
            <Cmt>{"// That's it."}</Cmt>{"\n"}
            <Cmt>{"// Survives restarts."}</Cmt>{"\n"}
            <Cmt>{"// Zero cost while waiting."}</Cmt>
          </pre>
          <div className="mt-4 flex flex-col gap-2 text-lg text-zinc-400">
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">&#x2713;</span> No server, no container, no cost
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">&#x2713;</span> Survives any restart
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">&#x2713;</span> Works with Promise.race for timeouts
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-6 font-mono text-xl text-zinc-400">
        <span className="rounded-full border border-white/10 bg-white/5 px-5 py-2">sleep(&quot;30s&quot;)</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-5 py-2">sleep(&quot;5m&quot;)</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-5 py-2">sleep(&quot;2h&quot;)</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-5 py-2">sleep(&quot;7d&quot;)</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-5 py-2">sleep(&quot;30d&quot;)</span>
      </div>
    </div>
  );
}
