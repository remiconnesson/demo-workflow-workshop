// ---------------------------------------------------------------------------
// Inspector link for agent demo slides.
//
// Renders ONE thing — a clickable "npx workflow inspect run <id>" line that
// deep-links to the local workflow web UI. The scrolling event feed that
// used to live here has been removed: per .impeccable.md rule #8, no
// developer consoles belong on the presentation surface. Event detail
// lives in the opt-in debug drawer keybind (Shift+D).
// ---------------------------------------------------------------------------

const WORKFLOW_WEB_PORT = 3456;

// Preserved so existing demo-pane callers keep their signature shape —
// the type is still imported in a handful of places even though we no
// longer render the feed inline.
export type DebugEvent = { kind: string; msg: string };

export function AgentDebugDrawer({
  runId,
}: {
  runId: string | undefined;
  events?: DebugEvent[];
}) {
  return (
    <div className="flex min-h-[48px] flex-1 flex-col justify-center rounded-lg border border-white/10 bg-zinc-950/95 px-5 py-3">
      {runId ? (
        <a
          href={`http://localhost:${WORKFLOW_WEB_PORT}/run/${runId}`}
          target="_blank"
          rel="noreferrer"
          className="truncate font-mono text-base text-emerald-300 transition-colors hover:text-white"
        >
          <span className="text-zinc-600">$</span> npx workflow inspect run{" "}
          {runId}
        </a>
      ) : (
        <span className="font-mono text-base text-zinc-600">
          <span className="text-zinc-700">$</span> npx workflow inspect run{" "}
          &lt;run_id&gt;
        </span>
      )}
    </div>
  );
}
