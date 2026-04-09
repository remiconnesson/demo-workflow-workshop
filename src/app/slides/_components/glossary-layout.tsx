import type { ReactNode } from "react";

export type GlossaryTerm = {
  term: string;
  definition: string;
  prompt: string;
};

export function GlossaryLayout({
  section,
  terms,
}: {
  section: string;
  terms: GlossaryTerm[];
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-20">
      <div className="flex items-center gap-4">
        <div className="h-[2px] w-12 bg-white/20" />
        <span className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
          Agentic Glossary
        </span>
        <div className="h-[2px] w-12 bg-white/20" />
      </div>

      <h2 className="text-4xl font-semibold tracking-tight text-zinc-300">
        {section}
      </h2>

      <p className="text-lg text-zinc-600 max-w-2xl text-center">
        Key phrases to use when prompting AI agents to build workflows
      </p>

      <div className="mt-4 grid grid-cols-2 gap-6 w-full max-w-6xl">
        {terms.map((t) => (
          <div
            key={t.term}
            className="rounded-2xl border border-white/10 bg-zinc-950 p-6 flex flex-col gap-3"
          >
            <div className="font-mono text-2xl font-semibold text-white">
              {t.term}
            </div>
            <div className="text-lg text-zinc-400">{t.definition}</div>
            <div className="mt-auto rounded-xl border border-white/5 bg-black px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600 mb-1">
                Try prompting
              </div>
              <div className="text-base text-zinc-300 italic">
                &ldquo;{t.prompt}&rdquo;
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
