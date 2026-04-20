import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FRAUD_VARIANTS,
  FRAUD_VARIANT_BY_SLUG,
} from "../../../_components/fraud-lab/_registry";
import { FraudVariantRenderer } from "../../../_components/fraud-lab/_renderer";

export function generateStaticParams() {
  return FRAUD_VARIANTS.map((v) => ({ variant: v.slug }));
}

type PageParams = {
  params: Promise<{ variant: string }>;
};

export default async function FraudVariantPage({ params }: PageParams) {
  const { variant: slug } = await params;
  const meta = FRAUD_VARIANT_BY_SLUG[slug];
  if (!meta) notFound();

  const idx = FRAUD_VARIANTS.findIndex((v) => v.slug === slug);
  const prev = idx > 0 ? FRAUD_VARIANTS[idx - 1] : FRAUD_VARIANTS[FRAUD_VARIANTS.length - 1];
  const next = idx < FRAUD_VARIANTS.length - 1 ? FRAUD_VARIANTS[idx + 1] : FRAUD_VARIANTS[0];

  return (
    <>
      <div className="mx-auto flex h-full w-full max-w-[1720px] flex-col gap-6 px-10 pt-20 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-red-400">
              fraud lab · variant {meta.number.toString().padStart(2, "0")} · {meta.title}
            </p>
            <h2 className="text-4xl font-semibold leading-[1.0] tracking-tight">
              {meta.tagline}
            </h2>
          </div>
          <Link
            href="/slides/observer/fraud-lab"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-zinc-300 transition-colors hover:border-red-500/40 hover:text-red-200"
          >
            ← all 25
          </Link>
        </div>

        <div className="min-h-0 flex-1">
          <FraudVariantRenderer slug={slug} />
        </div>
      </div>

      {/* prev / next arrows pinned to the edges */}
      <Link
        href={`/slides/observer/fraud-lab/${prev.slug}`}
        className="fixed top-1/2 left-4 -translate-y-1/2 rounded-full border border-white/10 bg-black/60 px-4 py-6 font-mono text-sm text-zinc-400 transition-colors hover:border-red-500/40 hover:text-red-200"
        aria-label={`Previous: ${prev.title}`}
      >
        ←
      </Link>
      <Link
        href={`/slides/observer/fraud-lab/${next.slug}`}
        className="fixed top-1/2 right-4 -translate-y-1/2 rounded-full border border-white/10 bg-black/60 px-4 py-6 font-mono text-sm text-zinc-400 transition-colors hover:border-red-500/40 hover:text-red-200"
        aria-label={`Next: ${next.title}`}
      >
        →
      </Link>
    </>
  );
}
