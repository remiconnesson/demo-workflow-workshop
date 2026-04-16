import Link from "next/link";
import { THEMES, VERBS, EXPERIMENTS } from "./_config/experiments";

const VERB_COLOR: Record<string, string> = {
  retry: "text-sky-400",
  suspend: "text-amber-400",
  rollback: "text-fuchsia-400",
};

export default function ExperimentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-screen bg-black text-white">
      <aside className="flex h-full w-[360px] shrink-0 flex-col border-r border-white/10 bg-zinc-950">
        <Link
          href="/experiments"
          className="block border-b border-white/10 px-6 py-5"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Experiments
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight">
            DurableAgent · 7 × 3
          </p>
        </Link>

        <div className="flex-1 overflow-y-auto">
          {THEMES.map((theme) => (
            <div
              key={theme.id}
              className="border-b border-white/5 px-6 py-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                {theme.name}
              </p>
              <div className="mt-2 flex flex-col gap-1">
                {VERBS.map((verb) => {
                  const slug = `${theme.id}-${verb.id}`;
                  const exp = EXPERIMENTS.find((e) => e.slug === slug);
                  if (!exp) return null;
                  return (
                    <Link
                      key={slug}
                      href={`/experiments/${slug}`}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 font-mono text-sm hover:bg-white/5"
                    >
                      <span className={VERB_COLOR[verb.id]}>
                        {verb.label.toLowerCase()}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {slug}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 px-6 py-4 text-xs text-zinc-600">
          21 demos · built to discover story shape
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
