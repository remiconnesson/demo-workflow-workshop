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
  /** Map of 1-based line number → tooltip text. Empty string = highlight only. */
  highlightLines?: Record<number, string>;
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
/** Convert [text](url) to links and **bold** to strong tags. */
function formatTip(text: string): string {
  let result = text.replace(
    /\[(.+?)\]\((.+?)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
  );
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong class="code-hl-keyword">$1</strong>');
  return result;
}

/** Wrap each line in a div, applying a highlight style + optional tooltip child. */
function wrapLines(html: string, highlightLines?: Record<number, string>): string {
  if (!highlightLines || Object.keys(highlightLines).length === 0) return html;
  const lines = html.split("<br>");
  return lines
    .map((line, i) => {
      const tooltip = highlightLines[i + 1];
      if (tooltip === undefined) return `<div>${line}</div>`;
      const tip = tooltip
        ? `<div class="code-hl-tip">${formatTip(tooltip)}</div>`
        : "";
      return `<div class="code-hl">${line}${tip}</div>`;
    })
    .join("");
}

export async function CodeBlock({
  code,
  lang = "ts",
  textClass = "text-2xl",
  className = "",
  highlightLines,
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
      dangerouslySetInnerHTML={{ __html: wrapLines(html, highlightLines) }}
    />
  );
}
