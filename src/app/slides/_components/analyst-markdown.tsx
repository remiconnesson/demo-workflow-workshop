"use client";

import { Streamdown } from "streamdown";

type AnalystMarkdownProps = {
  children: string;
};

/**
 * The analyst model occasionally emits a bold heading directly after a
 * sentence-ending period with no newline, e.g. `risk.**Issue identified:**`.
 * CommonMark renders that inline, so the heading collides with the previous
 * sentence on stage. Pre-insert a paragraph break for these cases, and also
 * split bold-heading run-ons (`**Section:** body**Next section:**`).
 */
function normalizeMarkdown(source: string): string {
  return source
    .replace(/([.!?]) ?\*\*([^*\n]+:)\*\*/g, "$1\n\n**$2**")
    .replace(/([^\n])\*\*([^*\n]+:)\*\*\s*\n/g, "$1\n\n**$2**\n");
}

export function AnalystMarkdown({ children }: AnalystMarkdownProps) {
  return (
    <div className="analyst-md text-xl leading-relaxed text-zinc-100">
      <Streamdown
        parseIncompleteMarkdown
        components={{
          p: ({ children, ...props }) => (
            <p className="my-0 first:mt-0 last:mb-0" {...props}>
              {children}
            </p>
          ),
          ul: ({ children, ...props }) => (
            <ul
              className="my-2 flex flex-col gap-1.5 pl-5 marker:text-zinc-500"
              {...props}
            >
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol
              className="my-2 flex flex-col gap-1.5 pl-6 marker:text-zinc-500"
              {...props}
            >
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="leading-relaxed" {...props}>
              {children}
            </li>
          ),
          strong: ({ children, ...props }) => (
            <strong className="font-semibold text-white" {...props}>
              {children}
            </strong>
          ),
          em: ({ children, ...props }) => (
            <em className="text-zinc-200 italic" {...props}>
              {children}
            </em>
          ),
          a: ({ children, ...props }) => (
            <a
              className="text-sky-300 underline decoration-sky-300/40 underline-offset-2 hover:decoration-sky-300"
              target="_blank"
              rel="noreferrer"
              {...props}
            >
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code
                  className="block overflow-x-auto rounded-lg border border-white/10 bg-black px-4 py-3 font-mono text-base leading-relaxed text-zinc-200"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[0.92em] text-sky-200"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children, ...props }) => (
            <pre className="my-3" {...props}>
              {children}
            </pre>
          ),
          h1: ({ children, ...props }) => (
            <h3 className="mt-2 mb-1 text-2xl font-semibold text-white" {...props}>
              {children}
            </h3>
          ),
          h2: ({ children, ...props }) => (
            <h3 className="mt-2 mb-1 text-2xl font-semibold text-white" {...props}>
              {children}
            </h3>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="mt-2 mb-1 text-xl font-semibold text-white" {...props}>
              {children}
            </h3>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="my-2 border-l-2 border-amber-400/50 pl-4 text-zinc-300 italic"
              {...props}
            >
              {children}
            </blockquote>
          ),
          table: ({ children, ...props }) => (
            <div className="my-3 overflow-x-auto">
              <table
                className="w-full border-collapse text-base"
                {...props}
              >
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th
              className="border-b border-white/10 px-3 py-2 text-left text-sm font-semibold tracking-[0.1em] text-zinc-400 uppercase"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              className="border-b border-white/5 px-3 py-2 text-zinc-200"
              {...props}
            >
              {children}
            </td>
          ),
          hr: (props) => (
            <hr className="my-3 border-white/10" {...props} />
          ),
        }}
      >
        {normalizeMarkdown(children)}
      </Streamdown>
    </div>
  );
}
