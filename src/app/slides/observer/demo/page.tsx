import Link from "next/link";
import { DemoSlideLayout } from "../../_components/demo-slide-layout";
import { SentinelDemo } from "../../_components/sentinel-demo";
import { AGENT_GROUPS } from "../../_data/agent-groups";
import { SENTINEL_VARIANTS } from "../../_data/sentinel-variants";

const group = AGENT_GROUPS["agent-observer"];
const variant = SENTINEL_VARIANTS.fraud;

export default function AgentObserverDemoSlide() {
  return (
    <>
      <DemoSlideLayout
        slide={group.slug}
        eyebrow={variant.eyebrow}
        headline="... an Agent loses its server?"
        rightPanel={<SentinelDemo variant={variant} />}
      />
      {process.env.NODE_ENV !== "production" && (
        <Link
          href="/slides/observer/variants"
          className="pointer-events-auto fixed top-8 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-zinc-950/80 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500 backdrop-blur transition-colors hover:text-white"
        >
          audition · 5 variants →
        </Link>
      )}
    </>
  );
}
