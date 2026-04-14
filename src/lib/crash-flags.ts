import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DIR = join(tmpdir(), "workflow-ga-slides-crash-flags");

function flagPath(orderId: string): string {
  return join(DIR, `${orderId.replace(/[^a-zA-Z0-9_-]/g, "_")}.flag`);
}

export function armCrash(orderId: string): void {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  const p = flagPath(orderId);
  writeFileSync(p, "1");
  console.info(`[crash-flags] armed orderId=${orderId} path=${p}`);
}

export function consumeCrashFlag(
  orderId: string,
  context: { runId?: string; step?: string } = {},
): boolean {
  const p = flagPath(orderId);
  if (!existsSync(p)) {
    return false;
  }
  try {
    unlinkSync(p);
  } catch {
    return false;
  }
  console.info(
    `[crash-flags] consume hit orderId=${orderId} runId=${context.runId ?? "?"} step=${context.step ?? "?"}`,
  );
  return true;
}
