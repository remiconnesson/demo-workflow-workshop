import { defineHook } from "workflow";
import { z } from "zod";

/**
 * Shared approval hook used by both the Observer (to ack anomaly flags) and
 * the Analyst (to gate menu-change proposals behind a human).
 *
 * Resumed from /api/agent/approve with a `token` + payload.
 */
export const approvalHook = defineHook({
  schema: z.object({
    approved: z.boolean(),
    reason: z.string().optional(),
  }),
});

export type ApprovalPayload = { approved: boolean; reason?: string };
