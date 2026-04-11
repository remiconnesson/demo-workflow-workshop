import { getNaiveAccumulation } from "../_data/naive-accumulation";

type NaivePanelProps = {
  slide: string;
};

/**
 * The right-rail "what you'd actually write" panel for Act 2 slides.
 *
 * Intentionally NO code contents — the audience can't read 13px mono
 * from the back of a room. We show a growing *file tree* instead, so
 * the visible cost is the number of files + the line-count bar, not
 * unreadable source. The accumulating file list is the whole mechanic.
 */
export function NaivePanel({ slide }: NaivePanelProps) {
  const entry = getNaiveAccumulation(slide);
  if (!entry) return null;

  const totalLines = entry.allFiles.reduce((sum, f) => sum + f.lines, 0);
  const newlyAddedNames = new Set(
    entry.allFiles.filter((f) => f.addedOnSlide === slide).map((f) => f.name),
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-red-500/25 bg-zinc-950 p-8">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold uppercase tracking-[0.28em] text-red-400/80">
          What you&apos;d actually write
        </div>
        <div className="flex items-center gap-3 font-mono text-xl">
          <span className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1 text-red-200">
            {entry.allFiles.length}{" "}
            {entry.allFiles.length === 1 ? "file" : "files"}
          </span>
          <span className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1 text-red-200">
            {totalLines} lines
          </span>
        </div>
      </div>

      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        {entry.allFiles.map((file) => {
          const isNew = newlyAddedNames.has(file.name);
          return (
            <div
              key={file.name}
              className={`flex items-center justify-between rounded-lg border px-4 py-2 font-mono transition-colors ${
                isNew
                  ? "border-red-500/40 bg-red-500/10 text-red-100"
                  : "border-white/5 bg-black/30 text-zinc-400"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isNew ? "bg-red-400" : "bg-zinc-700"
                  }`}
                />
                <span className="text-xl">{file.name}</span>
                {isNew ? (
                  <span className="ml-1 rounded-sm bg-red-500/25 px-2 py-0.5 text-xs uppercase tracking-wider text-red-100">
                    new
                  </span>
                ) : null}
              </div>
              <span className="text-lg text-red-400/60">{file.lines}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg border border-white/5 bg-black/40 px-4 py-3 text-center font-mono text-lg text-red-200/60">
        {entry.allFiles.length} files,{" "}
        <span className="text-red-300">{totalLines} lines</span> you
        don&apos;t write
      </div>
    </div>
  );
}
