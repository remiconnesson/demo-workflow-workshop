import { Kw, Fn, Str, Cmt, Punc } from "../_components/code-tokens";

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
          <Cmt>{"// Send approval email with the token in the link"}</Cmt>{"\n"}
          <Kw>await</Kw> <Fn>sendApprovalEmail</Fn><Punc>(</Punc>manager, token<Punc>)</Punc>{"\n"}
          {"\n"}
          <Cmt>{"// Race: approval vs. 1 hour timeout"}</Cmt>{"\n"}
          <Kw>const</Kw> result = <Kw>await</Kw> Promise.<Fn>race</Fn><Punc>([</Punc>{"\n"}
          {"  "}hook.<Fn>then</Fn><Punc>(</Punc>p <Punc>=&gt;</Punc> <Punc>({"{"}</Punc> kind: <Str>&quot;decision&quot;</Str>, p <Punc>{"})"}</Punc><Punc>)</Punc>,{"\n"}
          {"  "}<Fn>sleep</Fn><Punc>(</Punc><Str>&quot;1h&quot;</Str><Punc>)</Punc>.<Fn>then</Fn><Punc>(</Punc><Punc>()</Punc> <Punc>=&gt;</Punc> <Punc>({"{"}</Punc> kind: <Str>&quot;timeout&quot;</Str> <Punc>{"})"}</Punc><Punc>)</Punc>,{"\n"}
          <Punc>])</Punc>
        </pre>
      </div>

      {/* Right: flow diagram */}
      <div className="flex-1 max-w-md">
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Three outcomes
          </div>

          <div className="mt-6 flex flex-col gap-5">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full bg-emerald-400" />
                <span className="text-xl font-semibold text-emerald-300">Approved</span>
              </div>
              <div className="mt-2 text-base text-zinc-400">
                Manager clicks link in email &rarr; workflow fulfills order
              </div>
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full bg-red-400" />
                <span className="text-xl font-semibold text-red-300">Rejected</span>
              </div>
              <div className="mt-2 text-base text-zinc-400">
                Manager declines &rarr; workflow refunds and notifies customer
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 rounded-full bg-amber-400" />
                <span className="text-xl font-semibold text-amber-300">Timeout (1 hour)</span>
              </div>
              <div className="mt-2 text-base text-zinc-400">
                Nobody responds &rarr; auto-escalate to senior manager or auto-cancel
              </div>
            </div>
          </div>

          <p className="mt-6 text-base text-zinc-500">
            The workflow survives server restarts while waiting. The hook token in the email link is deterministic —
            the same link works even if the server reboots.
          </p>
        </div>
      </div>
    </div>
  );
}
