import { CodeBlock } from "./code-block";

type Tone = "naive" | "fix";

type CodeSlideCardProps = {
  code: string;
  tone: Tone;
  lang?: "ts" | "tsx" | "js" | "jsx";
};

const TONE_BORDER: Record<Tone, string> = {
  naive: "border-red-500/30",
  fix: "border-emerald-400/30",
};

/**
 * Shared card for full-width code-hero slides. The naive ("pain") and
 * fix ("workflow code") slides use identical typography and spacing —
 * only the accent border differs (red vs emerald).
 */
export function CodeSlideCard({ code, tone, lang = "ts" }: CodeSlideCardProps) {
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border ${TONE_BORDER[tone]} bg-black/60 p-6`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CodeBlock code={code} lang={lang} textClass="text-3xl" />
      </div>
    </div>
  );
}
