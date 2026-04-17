// Pin to globalThis so the value survives Next.js dev HMR module reloads
// and any duplicate module instances across route bundles. Otherwise the
// pattern slides lose their <run_id> substitution as soon as the dev server
// recompiles after a demo starts.
const STORE_KEY = "__workflow_ga_latest_run_id__";

type Store = { [STORE_KEY]?: string | null };
const g = globalThis as unknown as Store;

export function setLatestRunId(runId: string): void {
  g[STORE_KEY] = runId;
}

export function getLatestRunId(): string | null {
  return g[STORE_KEY] ?? null;
}
