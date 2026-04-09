import { Kw, Fn, Str, Cmt, Punc } from "../_components/code-tokens";

export default function FanOutSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: code */}
      <div className="flex-1 max-w-2xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Next Pattern
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Notify everyone, fail safely
        </h2>

        <pre className="mt-8 rounded-2xl border border-white/10 bg-zinc-950 p-8 font-mono text-xl leading-relaxed overflow-hidden">
          <Cmt>{"// Delivery delayed — notify all channels"}</Cmt>{"\n"}
          <Kw>const</Kw> results = <Kw>await</Kw> Promise.<Fn>allSettled</Fn><Punc>([</Punc>{"\n"}
          {"  "}<Fn>notifyCustomer</Fn><Punc>(</Punc>orderId, msg<Punc>)</Punc>,{"\n"}
          {"  "}<Fn>notifyRestaurant</Fn><Punc>(</Punc>orderId, msg<Punc>)</Punc>,{"\n"}
          {"  "}<Fn>notifyDriver</Fn><Punc>(</Punc>orderId, msg<Punc>)</Punc>,{"\n"}
          {"  "}<Fn>notifySupport</Fn><Punc>(</Punc>orderId, msg<Punc>)</Punc>,{"\n"}
          <Punc>])</Punc>{"\n"}
          {"\n"}
          <Kw>const</Kw> ok = results.<Fn>filter</Fn><Punc>(</Punc>{"\n"}
          {"  "}r <Punc>=&gt;</Punc> r.status === <Str>&quot;fulfilled&quot;</Str>{"\n"}
          <Punc>)</Punc>.length
        </pre>

        <p className="mt-6 text-xl text-zinc-400">
          <span className="font-mono text-white">allSettled</span> — one failing channel
          doesn&apos;t block the others. Each step is durable and independently retried.
        </p>
      </div>

      {/* Right: visual fan-out with mixed results */}
      <div className="flex-1 max-w-md">
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Broadcast result
          </div>

          <div className="mt-6 flex flex-col gap-4">
            {[
              { channel: "Customer SMS", status: "fulfilled", time: "0.3s", icon: "&#x2713;" },
              { channel: "Restaurant API", status: "fulfilled", time: "0.8s", icon: "&#x2713;" },
              { channel: "Driver push", status: "rejected", time: "2.1s", icon: "!" },
              { channel: "Support Slack", status: "fulfilled", time: "0.5s", icon: "&#x2713;" },
            ].map((ch) => (
              <div key={ch.channel} className={`flex items-center gap-5 rounded-xl border p-5 ${
                ch.status === "fulfilled"
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-red-500/20 bg-red-500/5"
              }`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-lg font-semibold ${
                  ch.status === "fulfilled"
                    ? "border-emerald-400 text-emerald-300"
                    : "border-red-400 text-red-300"
                }`} dangerouslySetInnerHTML={{ __html: ch.icon }} />
                <div className="flex-1">
                  <div className="text-lg font-semibold">{ch.channel}</div>
                  <div className="font-mono text-sm text-zinc-500">
                    {ch.status} · {ch.time}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-black p-4 text-center">
            <span className="font-mono text-2xl font-semibold">
              <span className="text-emerald-400">3</span>
              <span className="text-zinc-600"> / </span>
              <span className="text-zinc-300">4</span>
            </span>
            <span className="ml-3 text-lg text-zinc-500">channels delivered</span>
          </div>
        </div>
      </div>
    </div>
  );
}
