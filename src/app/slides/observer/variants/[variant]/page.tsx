import { notFound } from "next/navigation";
import { DemoSlideLayout } from "../../../_components/demo-slide-layout";
import { SentinelDemo } from "../../../_components/sentinel-demo";
import { AGENT_GROUPS } from "../../../_data/agent-groups";
import {
  SENTINEL_VARIANT_ORDER,
  SENTINEL_VARIANTS,
  type SentinelVariantSlug,
} from "../../../_data/sentinel-variants";
import { VariantNav } from "./variant-nav";

const group = AGENT_GROUPS["agent-observer"];

export function generateStaticParams() {
  return SENTINEL_VARIANT_ORDER.map((variant) => ({ variant }));
}

type PageParams = {
  params: Promise<{ variant: string }>;
};

export default async function SentinelVariantPage({ params }: PageParams) {
  const { variant: slug } = await params;
  const variant = SENTINEL_VARIANTS[slug as SentinelVariantSlug];
  if (!variant) notFound();

  return (
    <>
      <DemoSlideLayout
        slide={group.slug}
        eyebrow={variant.eyebrow}
        headline="... an Agent loses its server?"
        rightPanel={<SentinelDemo variant={variant} />}
      />
      <VariantNav currentSlug={variant.slug} />
    </>
  );
}
