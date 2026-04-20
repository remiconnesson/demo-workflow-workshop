import { getWritable } from "workflow";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Offline / AI-Gateway fallback for DurableAgent demos.
//
// The three workshop agents (first-agent, observer, analyst) stream through
// the Vercel AI Gateway. When that path fails (offline laptop, expired key,
// gateway outage) the demo shouldn't go blank on stage. This helper emits
// a minimal scripted turn onto the same writable the real agent would use,
// so the audience sees text land in the chat and the timeline light up.
//
// Writer acquisition must happen inside a "use step" boundary (see
// reference.md, "Stream progress"). We build the full chunk list at
// workflow scope, then delegate the actual writes to a single step.
//
// Usage inside a workflow:
//
//   try {
//     await agent.stream({ messages, writable: getWritable<UIMessageChunk>() });
//   } catch (err) {
//     if (isGatewayFailure(err)) {
//       await runMockAgentTurn({ script });
//     } else {
//       throw err;
//     }
//   }
// ---------------------------------------------------------------------------

export type MockToolStep = {
  toolName: string;
  toolCallId: string;
  input: unknown;
  output: unknown;
};

export type MockAgentScript = {
  /** Text streamed before any tool call (optional). */
  preludeText?: string;
  /** Tool invocations to emit as tool-input-available + tool-output-available. */
  toolCalls?: MockToolStep[];
  /** Text streamed after all tool calls (optional). */
  closingText?: string;
};

export type RunMockAgentOpts = {
  script: MockAgentScript;
  /**
   * Prefix for text-part IDs. REQUIRED: must be a deterministic value
   * derived from workflow inputs (loop index, message count, …) so the
   * chunk IDs replay identically. Never use Date.now() or Math.random()
   * here because the workflow runtime replays workflow-scope code on resume.
   * Example: `mock-observer-${loopIndex}`.
   */
  idPrefix: string;
};

/**
 * Heuristic: treat any error thrown out of `agent.stream()` as a gateway
 * failure when the presenter has explicitly opted in via env var, or when
 * the error text matches a known failure mode. Err on the side of "real
 * failures should still surface." The demo fallback only kicks in for
 * transport-level problems.
 */
export function isGatewayFailure(err: unknown): boolean {
  if (process.env.WORKFLOW_MOCK_AGENT === "1") return true;
  if (!err) return false;
  const text =
    err instanceof Error
      ? `${err.name} ${err.message}`
      : String(err);
  const patterns = [
    /AI_NoSuchModelError/i,
    /AI_APICallError/i,
    /AI_AuthenticationError/i,
    /AI_InvalidResponseDataError/i,
    /gateway/i,
    /ENOTFOUND/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /fetch failed/i,
    /401|403|429|5\d{2}/,
    /unauthorized/i,
    /forbidden/i,
    /rate.?limit/i,
  ];
  return patterns.some((re) => re.test(text));
}

/**
 * Should the workflow skip the real agent call entirely and go straight to
 * the mock? Only when the presenter opts in. We never silently disable
 * the real path.
 */
export function shouldForceMockAgent(): boolean {
  return process.env.WORKFLOW_MOCK_AGENT === "1";
}

function buildChunks(
  script: MockAgentScript,
  idPrefix: string,
): UIMessageChunk[] {
  const chunks: UIMessageChunk[] = [];
  chunks.push({ type: "start" } as UIMessageChunk);
  chunks.push({ type: "start-step" } as UIMessageChunk);

  if (script.preludeText) {
    const id = `${idPrefix}-prelude`;
    chunks.push({ type: "text-start", id } as UIMessageChunk);
    chunks.push({
      type: "text-delta",
      id,
      delta: script.preludeText,
    } as UIMessageChunk);
    chunks.push({ type: "text-end", id } as UIMessageChunk);
  }

  if (script.toolCalls) {
    for (const call of script.toolCalls) {
      chunks.push({
        type: "tool-input-available",
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        input: call.input,
      } as UIMessageChunk);
      chunks.push({
        type: "tool-output-available",
        toolCallId: call.toolCallId,
        output: call.output,
      } as UIMessageChunk);
    }
  }

  if (script.closingText) {
    const id = `${idPrefix}-closing`;
    chunks.push({ type: "text-start", id } as UIMessageChunk);
    chunks.push({
      type: "text-delta",
      id,
      delta: script.closingText,
    } as UIMessageChunk);
    chunks.push({ type: "text-end", id } as UIMessageChunk);
  }

  chunks.push({ type: "finish-step" } as UIMessageChunk);
  chunks.push({ type: "finish" } as UIMessageChunk);
  return chunks;
}

/**
 * Step-boundary writer: acquires the workflow writable, writes every chunk,
 * releases the lock. Writer acquisition inside a workflow function is only
 * legal from a "use step" function (reference.md, "Stream progress").
 */
async function writeMockChunks(chunks: UIMessageChunk[]): Promise<void> {
  "use step";
  const writer = getWritable<UIMessageChunk>().getWriter();
  try {
    for (const chunk of chunks) {
      await writer.write(chunk);
    }
  } finally {
    writer.releaseLock();
  }
}

/**
 * Emit a scripted turn onto the agent's UIMessageChunk stream.
 *
 * Builds the full chunk list synchronously, then delegates the write to a
 * single step. This is safe to call directly from workflow scope because the
 * caller does NOT need to wrap it in "use step".
 */
export async function runMockAgentTurn({
  script,
  idPrefix,
}: RunMockAgentOpts): Promise<void> {
  const chunks = buildChunks(script, idPrefix);
  await writeMockChunks(chunks);
}
