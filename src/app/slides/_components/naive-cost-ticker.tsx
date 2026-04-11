import { getNaiveAccumulation } from "../_data/naive-accumulation";

type NaiveCostTickerProps = {
  slide: string;
};

/**
 * One-line ambient ticker that replaces the old right-rail NaivePanel
 * on Act 2 slides. Shows the running cost of the naive implementation
 * (file count + total lines) and highlights the file that was added
 * on this slide. Full file-tree reveal still happens once on slide 13.
 *
 * Per .impeccable.md projector rules, everything audience-read is
 * text-xl or larger. The tiny uppercase eyebrow is a presenter-facing
 * label (label exception).
 */
export function NaiveCostTicker({ slide }: NaiveCostTickerProps) {
  const entry = getNaiveAccumulation(slide);
  if (!entry) return null;

  const totalLines = entry.allFiles.reduce((sum, f) => sum + f.lines, 0);
  const newestFile = [...entry.allFiles]
    .reverse()
    .find((f) => f.addedOnSlide === slide);

  return (
    <div className="shrink-0 rounded-2xl border border-red-500/30 bg-red-500/5 px-6 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.28em] text-red-300/80">
        Naive cost · growing
      </div>
      <div className="mt-2 flex items-baseline gap-5 font-mono">
        <span className="text-3xl font-semibold text-red-200">
          {entry.allFiles.length}{" "}
          <span className="text-xl text-red-400/80">
            {entry.allFiles.length === 1 ? "file" : "files"}
          </span>
        </span>
        <span className="text-3xl font-semibold text-red-200">
          {totalLines}{" "}
          <span className="text-xl text-red-400/80">lines</span>
        </span>
      </div>
      {newestFile ? (
        <div className="mt-2 font-mono text-lg text-red-300/80">
          + {newestFile.name}
          <span className="text-red-400/50"> ({newestFile.lines} lines)</span>
        </div>
      ) : null}
    </div>
  );
}
