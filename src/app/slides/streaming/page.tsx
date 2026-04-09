import { Kw, Dir, Fn, Cmt, Punc } from "../_components/code-tokens";

export default function StreamingSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: code */}
      <div className="flex-1 max-w-2xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Streaming
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Watch it happen in real time
        </h2>

        <pre className="mt-10 rounded-2xl border border-white/10 bg-zinc-950 p-10 font-mono text-2xl leading-relaxed overflow-hidden">
          <Kw>async function</Kw> <Fn>emit</Fn><Punc>(</Punc>event<Punc>)</Punc> <Punc>{"{"}</Punc>{"\n"}
          {"  "}<Dir>&quot;use step&quot;</Dir>{"\n"}
          {"\n"}
          {"  "}<Kw>const</Kw> writer = <Fn>getWritable</Fn><Punc>()</Punc>.<Fn>getWriter</Fn><Punc>()</Punc>{"\n"}
          {"  "}<Kw>await</Kw> writer.<Fn>write</Fn><Punc>(</Punc>event<Punc>)</Punc>{"\n"}
          {"  "}writer.<Fn>releaseLock</Fn><Punc>()</Punc>{"\n"}
          <Punc>{"}"}</Punc>
        </pre>

        <p className="mt-6 text-xl text-zinc-400">
          NDJSON over HTTP. Every step emits structured events via{" "}
          <span className="font-mono text-white">getWritable()</span>.
        </p>
      </div>

      {/* Right: mock event feed */}
      <div className="flex-1 max-w-xl">
        <div className="rounded-2xl border border-white/10 bg-zinc-950 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-10 py-6">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Logs
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">Event stream</div>
            </div>
            <div className="font-mono text-lg text-zinc-500">6 events</div>
          </div>

          <div className="px-10 py-6 font-mono text-lg leading-loose">
            <EventLine time="12:00:01" kind="RUN" color="text-sky-400" msg="validateOrder" />
            <EventLine time="12:00:01" kind="OK " color="text-emerald-400" msg="validateOrder · 2 items, $8.50" />
            <EventLine time="12:00:02" kind="RUN" color="text-sky-400" msg="chargePayment" />
            <EventLine time="12:00:02" kind="OK " color="text-emerald-400" msg="chargePayment · Charged $10.50" />
            <EventLine time="12:00:03" kind="WAI" color="text-amber-400" msg="notifyRestaurant · awaiting hook" />
            <EventLine time="12:00:05" kind="HOK" color="text-amber-400" msg="notifyRestaurant · accepted" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EventLine({
  time,
  kind,
  color,
  msg,
}: {
  time: string;
  kind: string;
  color: string;
  msg: string;
}) {
  return (
    <div className="flex items-start gap-6 border-b border-white/5 py-3 last:border-0">
      <span className="shrink-0 text-zinc-600">{time}</span>
      <span className={`shrink-0 font-semibold ${color}`}>{kind}</span>
      <span className="flex-1 text-zinc-200">{msg}</span>
    </div>
  );
}
