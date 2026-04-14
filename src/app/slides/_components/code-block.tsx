import { codeToHtml } from "shiki";

type CodeBlockProps = {
  code: string;
  lang?: "ts" | "tsx" | "js" | "jsx";
  /**
   * Tailwind text-size class (e.g. "text-3xl", "text-2xl"). Applied to
   * the wrapping <pre> — Shiki's inline token spans inherit font-size.
   */
  textClass?: string;
  className?: string;
};

/**
 * Async server component that syntax-highlights a code string with
 * Shiki and renders it as styled HTML. Runs once per slide at build
 * time (static prerender), so there is no runtime cost for the
 * highlighter bundle on the client.
 *
 * Theme: `github-dark-default` — readable against zinc-950/black
 * surfaces with enough contrast to land from 30 feet.
 *
 * We use `structure: "inline"` so Shiki returns naked token spans
 * with real newlines between them, and we wrap those in our own
 * <pre> so the outer card controls the background and padding.
 */
export async function CodeBlock({
  code,
  lang = "ts",
  textClass = "text-2xl",
  className = "",
}: CodeBlockProps) {
  const html = await codeToHtml(code, {
    lang,
    theme: "github-dark-default",
    structure: "inline",
  });

  return (
    <pre
      className={`m-0 whitespace-pre font-mono ${textClass} leading-[1.5] ${className}`}
      // biome-ignore lint: Shiki emits trusted, pre-escaped HTML
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
