import { getNaiveAccumulation } from "../_data/naive-accumulation";

type NaivePanelProps = {
  slide: string;
};

export function NaivePanel({ slide }: NaivePanelProps) {
  const entry = getNaiveAccumulation(slide);
  if (!entry) return null;

  const totalLines = entry.allFiles.reduce((sum, f) => sum + f.lines, 0);
  const focus = entry.allFiles.find((f) => f.name === entry.focusFile);
  const newlyAdded = entry.allFiles.filter((f) => f.addedOnSlide === slide);
  const newlyAddedNames = new Set(newlyAdded.map((f) => f.name));

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-red-500/20 bg-zinc-950 p-6">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-400/80">
          What you'd actually write
        </div>
        <div className="flex items-center gap-3 font-mono text-sm">
          <span className="rounded-full border border-red-500/30 bg-red-500/5 px-3 py-1 text-red-300">
            {entry.allFiles.length} {entry.allFiles.length === 1 ? "file" : "files"}
          </span>
          <span className="rounded-full border border-red-500/30 bg-red-500/5 px-3 py-1 text-red-300">
            {totalLines} lines
          </span>
        </div>
      </div>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[180px_1fr] gap-4 overflow-hidden">
        {/* File tree */}
        <div className="flex min-h-0 flex-col gap-1 overflow-y-auto border-r border-white/5 pr-3 font-mono text-[12px]">
          {entry.allFiles.map((file) => {
            const isFocus = file.name === entry.focusFile;
            const isNew = newlyAddedNames.has(file.name);
            return (
              <div
                key={file.name}
                className={`flex items-center justify-between rounded px-2 py-1 transition-colors ${
                  isFocus
                    ? "bg-red-500/10 text-red-200"
                    : isNew
                      ? "text-red-300/80"
                      : "text-zinc-500"
                }`}
              >
                <span className="truncate">{file.name}</span>
                {isNew ? (
                  <span className="ml-2 shrink-0 rounded-sm bg-red-500/20 px-1 text-[10px] uppercase tracking-wider text-red-200">
                    new
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Focus file code */}
        <div className="flex min-h-0 flex-col overflow-hidden">
          {focus ? (
            <>
              <div className="mb-2 flex items-center justify-between font-mono text-[12px] text-zinc-500">
                <span>{focus.name}</span>
                <span>{focus.lines} lines</span>
              </div>
              <pre className="min-h-0 flex-1 overflow-y-auto whitespace-pre rounded-lg border border-white/5 bg-black/60 p-4 font-mono text-[13px] leading-relaxed text-zinc-300">
                {focus.code}
              </pre>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
