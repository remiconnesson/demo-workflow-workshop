import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Offline / AI-Gateway fallback for DurableAgent demos.
//
// The three workshop agents (first-agent, observer, analyst) stream through
// the Vercel AI Gateway. When that path fails — offline laptop, expired key,
// gateway outage — the demo shouldn't go blank on stage. This helper emits
// a minimal scripted turn onto the same `writable` the real agent uses, so
// the audience sees text land in the chat and the timeline light up.
//
// Usage inside a workflow:
//
//   try {
//     await agent.stream({ messages, writable });
//   } catch (err) {
//     if (isGatewayFailure(err)) {
//       await runMockAgentTurn({ writable, script });
//     } else {
//       throw err;
//     }
//   }
//
// The mock is deliberately thin — it keeps the demo visible, not perfect.
// ---------------------------------------------------------------------------

export type MockToolStep = {
  toolName: string;
  toolCallId: string;
  input: unknown;
  output: unknown;
};

export type MockAgentScript = {
  /** Text chunks streamed before any tool call (optional). */
  preludeText?: string;
  /** Tool invocations to emit as tool-input-available + tool-output-available. */
  toolCalls?: MockToolStep[];
  /** Text chunks streamed after all tool calls (optional). */
  closingText?: string;
};

export type RunMockAgentOpts = {
  writable: WritableStream<UIMessageChunk>;
  script: MockAgentScript;
  /** Override the text-delta character cadence (ms). Default 18ms. */
  deltaDelayMs?: number;
  /**
   * Prefix for text-part IDs so repeated fallback turns (e.g. observer's
   * 20-loop scan) don't collide on stream IDs. Include whatever makes the
   * caller unique — e.g. `mock-observer-${loopIndex}`.
   */
  idPrefix?: string;
};

/**
 * Heuristic: treat any error thrown out of `agent.stream()` as a gateway
 * failure when the presenter has explicitly opted in via env var, or when
 * the error text matches a known failure mode. Err on the side of "real
 * failures should still surface" — the demo fallback only kicks in for
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
 * the mock? Only when the presenter opts in — we never silently disable
 * the real path.
 */
export function shouldForceMockAgent(): boolean {
  return process.env.WORKFLOW_MOCK_AGENT === "1";
}

async function streamText(
  writer: WritableStreamDefaultWriter<UIMessageChunk>,
  id: string,
  text: string,
  deltaDelayMs: number,
): Promise<void> {
  await writer.write({ type: "text-start", id } as UIMessageChunk);
  // Emit per-word deltas so the audience sees the "typing" feel rather
  // than one big chunk.
  for (const word of text.split(/(\s+)/)) {
    if (word === "") continue;
    await writer.write({
      type: "text-delta",
      id,
      delta: word,
    } as UIMessageChunk);
    if (deltaDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, deltaDelayMs));
    }
  }
  await writer.write({ type: "text-end", id } as UIMessageChunk);
}

/**
 * Emit a scripted turn onto the agent's UIMessageChunk stream.
 *
 * Note: we hold a writer for the lifetime of the scripted turn. This mirrors
 * what the real DurableAgent does — it owns the writer until the turn ends.
 * Workflows that use a single `getWritable` across multiple turns should
 * release the lock before calling this helper again; the three demo
 * workflows currently re-acquire per turn, so this is safe.
 */
export async function runMockAgentTurn({
  writable,
  script,
  deltaDelayMs = 18,
  idPrefix,
}: RunMockAgentOpts): Promise<void> {
  const writer = writable.getWriter();
  const prefix =
    idPrefix ??
    `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await writer.write({
      type: "start",
    } as UIMessageChunk);
    await writer.write({
      type: "start-step",
    } as UIMessageChunk);

    if (script.preludeText) {
      await streamText(
        writer,
        `${prefix}-prelude`,
        script.preludeText,
        deltaDelayMs,
      );
    }

    if (script.toolCalls) {
      for (const call of script.toolCalls) {
        await writer.write({
          type: "tool-input-available",
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          input: call.input,
        } as UIMessageChunk);
        await writer.write({
          type: "tool-output-available",
          toolCallId: call.toolCallId,
          output: call.output,
        } as UIMessageChunk);
      }
    }

    if (script.closingText) {
      await streamText(
        writer,
        `${prefix}-closing`,
        script.closingText,
        deltaDelayMs,
      );
    }

    await writer.write({
      type: "finish-step",
    } as UIMessageChunk);
    await writer.write({
      type: "finish",
    } as UIMessageChunk);
  } finally {
    writer.releaseLock();
  }
}
