let latestRunId: string | null = null;

export function setLatestRunId(runId: string): void {
  latestRunId = runId;
}

export function getLatestRunId(): string | null {
  return latestRunId;
}
