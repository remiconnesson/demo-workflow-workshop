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

/**
 * Split optional `LABEL:: body` prefix. Labels become a small-caps eyebrow
 * above the tooltip body ("CONCEPT", "WHY", "DOCS"…). Omitting the prefix
 * renders the tooltip without an eyebrow — existing call sites are unchanged.
 */
function splitEyebrow(raw: string): { label: string | null; body: string } {
  const match = raw.match(/^\s*([A-Z][A-Z0-9 _-]{1,20})::\s*([\s\S]+)$/);
  if (!match) return { label: null, body: raw };
  return { label: match[1].trim(), body: match[2] };
}

/** Wrap each line in a div, applying a highlight style + optional tooltip child.
 *
 * Tooltips default to "popping up" above the highlighted line. For lines near
 * the top of the block (first 3), we flip the tooltip below so it isn't
 * clipped by the editor chrome / container top edge. */
function wrapLines(html: string, highlightLines?: Record<number, string>): string {
  if (!highlightLines || Object.keys(highlightLines).length === 0) return html;
  const lines = html.split("<br>");
  const FLIP_DOWN_BEFORE_LINE = 4; // lines 1..3 flip below
  return lines
    .map((line, i) => {
      const lineNumber = i + 1;
      const tooltip = highlightLines[lineNumber];
      if (tooltip === undefined) return `<div>${line}</div>`;
      if (!tooltip) return `<div class="code-hl">${line}</div>`;
      const flip = lineNumber < FLIP_DOWN_BEFORE_LINE;
      const tipClass = flip ? "code-hl-tip code-hl-tip--below" : "code-hl-tip";
      const hlClass = flip ? "code-hl code-hl--flip" : "code-hl";
      const { label, body } = splitEyebrow(tooltip);
      const eyebrow = label
        ? `<div class="code-hl-tip-eyebrow">${label}</div>`
        : "";
      const tip = `<div class="${tipClass}">${eyebrow}<div class="code-hl-tip-body">${formatTip(body)}</div></div>`;
      return `<div class="${hlClass}">${line}${tip}</div>`;
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
