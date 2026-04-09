import { Kw, Fn, Str, Cmt, Punc, Typ } from "../_components/code-tokens";

export default function TokensSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: token explanation */}
      <div className="flex-1 max-w-2xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Hook Tokens
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Deterministic addresses
        </h2>

        <pre className="mt-8 rounded-2xl border border-white/10 bg-zinc-950 p-8 font-mono text-2xl leading-relaxed overflow-hidden">
          <Kw>const</Kw> tokens = <Punc>{"{"}</Punc>{"\n"}
          {"  "}restaurant: <Str>{"`order:${orderId}:restaurant-accept`"}</Str>,{"\n"}
          {"  "}driver:     <Str>{"`order:${orderId}:driver-accept`"}</Str>,{"\n"}
          {"  "}delivered:  <Str>{"`order:${orderId}:delivered`"}</Str>,{"\n"}
          <Punc>{"}"}</Punc>{"\n"}
          {"\n"}
          <Cmt>{"// resume from anywhere:"}</Cmt>{"\n"}
          <Fn>resumeHook</Fn><Punc>(</Punc>tokens.restaurant, <Punc>{"{"}</Punc> accepted: <Kw>true</Kw> <Punc>{"})"}</Punc>
        </pre>

        <p className="mt-6 text-xl text-zinc-400">
          The token is a string you control. Put it in a Slack button, an email link,
          a webhook URL. The workflow wakes up when someone calls <span className="font-mono text-white">resumeHook</span> with that token.
        </p>
      </div>

      {/* Right: demo UI showing the waiting state + buttons */}
      <div className="flex-1 max-w-lg flex flex-col gap-6">
        {/* Recreated "Awaiting manual resolution" card from the demo */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
            Awaiting manual resolution
          </div>
          <div className="mt-2 text-2xl font-semibold">notifyRestaurant</div>
          <div className="mt-2 font-mono text-base text-amber-400/70">
            token: order:ord_a3x9:restaurant-accept
          </div>
          <div className="mt-5 flex flex-wrap gap-4">
            <div className="rounded-xl bg-white px-6 py-4 text-lg font-semibold text-black">
              Restaurant accept
            </div>
            <div className="rounded-xl border border-red-500/40 px-6 py-4 text-lg font-semibold text-red-400">
              Restaurant reject
            </div>
          </div>
        </div>

        {/* Arrow showing what happens */}
        <div className="flex items-center gap-4 px-4">
          <div className="h-[2px] flex-1 bg-white/10" />
          <span className="text-zinc-500 text-lg">click triggers</span>
          <div className="h-[2px] flex-1 bg-white/10" />
        </div>

        {/* The API call */}
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Under the hood
          </div>
          <pre className="mt-4 font-mono text-lg leading-relaxed text-zinc-300">
            <Kw>POST</Kw> /api/orders/ord_a3x9/resume{"\n"}
            <Punc>{"{"}</Punc>{"\n"}
            {"  "}kind: <Str>&quot;restaurant-accept&quot;</Str>,{"\n"}
            {"  "}accepted: <Kw>true</Kw>{"\n"}
            <Punc>{"}"}</Punc>
          </pre>
          <p className="mt-4 text-base text-zinc-500">
            The server calls <span className="font-mono text-zinc-300">resumeHook(token, payload)</span>.
            The workflow continues from exactly where it paused.
          </p>
        </div>
      </div>
    </div>
  );
}
