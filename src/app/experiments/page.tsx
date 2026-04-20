import Link from "next/link";
import { THEMES, VERBS, EXPERIMENTS } from "./_config/experiments";

const VERB_ACCENT: Record<string, string> = {
  retry: "border-sky-500/30 bg-sky-500/5 text-sky-300",
  suspend: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  rollback: "border-fuchsia-500/30 bg-fuchsia-500/5 text-fuchsia-300",
};

export default function ExperimentsIndexPage() {
  return (
    <div className="h-full overflow-y-auto px-12 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Story discovery
          </p>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight">
            7 DurableAgents × 3 verbs
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-zinc-400">
            Each theme runs one DurableAgent across three demos (retry,
            suspend, rollback) so we can see which agent story lands
            hardest for the workshop.
          </p>
        </header>

        <Link
          href="/experiments/our-first-agent"
          className="mb-6 block rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 transition hover:bg-emerald-500/10"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Start here · zeroth demo
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Our first agent
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            A DurableAgent with one slow tool. Hit F5 while it&apos;s
            streaming, and the same sentence finishes itself. The quick
            win before the three properties.
          </p>
          <p className="mt-3 font-mono text-xs text-zinc-500">
            /experiments/our-first-agent
          </p>
        </Link>

        <div className="flex flex-col gap-6">
          {THEMES.map((theme) => (
            <section
              key={theme.id}
              className="rounded-2xl border border-white/10 bg-zinc-950 p-6"
            >
              <div className="mb-5 flex items-baseline justify-between">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {theme.name}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {theme.tagline}
                  </p>
                </div>
                <span className="font-mono text-xs text-zinc-600">
                  {theme.id}
                </span>
              </div>

              <p className="mb-5 text-sm leading-relaxed text-zinc-400">
                {theme.agentRole}
              </p>

              <div className="grid grid-cols-3 gap-3">
                {VERBS.map((verb) => {
                  const slug = `${theme.id}-${verb.id}`;
                  const exp = EXPERIMENTS.find((e) => e.slug === slug);
                  if (!exp) return null;
                  return (
                    <Link
                      key={slug}
                      href={`/experiments/${slug}`}
                      className={`flex flex-col gap-2 rounded-xl border p-4 transition hover:bg-white/5 ${VERB_ACCENT[verb.id]}`}
                    >
                      <span className="font-mono text-xs uppercase tracking-[0.2em]">
                        {verb.label}
                      </span>
                      <span className="font-mono text-xs text-zinc-500">
                        /experiments/{slug}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
