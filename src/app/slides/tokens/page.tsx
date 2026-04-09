import { Kw, Fn, Str, Cmt, Punc } from "../_components/code-tokens";
import { LiveOrderConceptLab } from "../_components/live-order-concept-lab";
import { slideScenarios } from "../_lib/slide-scenarios";

export default function TokensSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-16 px-20">
      {/* Left: token explanation */}
      <div className="flex-1 max-w-xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Hook Tokens
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Deterministic addresses
        </h2>

        <pre className="mt-8 rounded-2xl border border-white/10 bg-zinc-950 p-8 font-mono text-xl leading-relaxed overflow-hidden">
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
          or a webhook. The workflow wakes up when someone calls <span className="font-mono text-white">resumeHook</span> with that token.
        </p>
      </div>

      {/* Right: live hook demo */}
      <div className="flex-1 max-w-xl">
        <LiveOrderConceptLab
          slide="tokens"
          scenario={slideScenarios.tokens}
        />
      </div>
    </div>
  );
}
