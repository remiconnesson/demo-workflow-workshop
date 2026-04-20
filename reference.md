=== reference/production_readiness_scorecard.md ===
# Production Readiness Scorecard

Score each item from 0 to 2.

```txt
0 = missing or unsafe
1 = partially handled
2 = production-ready
```

## Workflow boundary

| Item | Score | Evidence |
|---|---:|---|
| Workflow functions only orchestrate. | | |
| DB/API/email/payment/file operations are in steps. | | |
| Step functions are small enough to inspect and retry. | | |
| Workflow input and output types are documented. | | |

## Idempotency and retries

| Item | Score | Evidence |
|---|---:|---|
| Every unsafe side-effecting step has an idempotency key. | | |
| `getStepMetadata().stepId` is used where appropriate. | | |
| DB writes use upsert or unique workflow-step records where needed. | | |
| Provider conflict/already-processed responses are handled as success where appropriate. | | |
| Retry counts are intentionally set for flaky providers. | | |

## Error classification

| Item | Score | Evidence |
|---|---:|---|
| Invalid input/business failures throw `FatalError`. | | |
| Rate limits use `RetryableError` with `retryAfter` where useful. | | |
| Temporary network/provider failures retry. | | |
| Compensation steps exist for partial external success. | | |

## Durable waits and external input

| Item | Score | Evidence |
|---|---:|---|
| Time waits use `sleep()`. | | |
| Human approval uses hooks. | | |
| HTTP callbacks use webhooks or server-side hook resume routes. | | |
| Hook tokens are deterministic and namespaced. | | |
| Hook resume endpoints authenticate and authorize callers. | | |
| Long waits have timeout paths where appropriate. | | |

## Client experience

| Item | Score | Evidence |
|---|---:|---|
| Long-running start routes return `202` and `runId`. | | |
| Status route uses `getRun()`. | | |
| Progress stream is available when users need progress. | | |
| Stream reconnect uses `run.getReadable({ startIndex })`. | | |
| UI can recover after browser refresh. | | |

## Observability and operations

| Item | Score | Evidence |
|---|---:|---|
| Successful run inspected in CLI/UI. | | |
| Failed run inspected in CLI/UI. | | |
| Retried step inspected. | | |
| Waiting hook/webhook inspected. | | |
| Stream output inspected. | | |
| Operational runbook exists for stuck/failed runs. | | |

## Deployment and versioning

| Item | Score | Evidence |
|---|---:|---|
| Local World is used only locally. | | |
| Production uses Vercel World or explicit production World. | | |
| Fluid compute is enabled on Vercel. | | |
| Workflow function names and file paths are treated as stable. | | |
| Input/output schema changes are backward-compatible or versioned. | | |

## DurableAgent-specific

| Item | Score | Evidence |
|---|---:|---|
| Agent runs inside a workflow. | | |
| Tool side effects are steps. | | |
| Tool side effects are idempotent. | | |
| Destructive/costly tools require human approval or policy checks. | | |
| Chat route returns `x-workflow-run-id`. | | |
| Stream reconnect route exists. | | |
| Chat history is persisted outside the transient UI stream. | | |
| Integration tests cover approval, rejection, timeout, and reconnect. | | |

## Scoring

```txt
0-20: demo-grade only. Do not ship.
21-40: promising, but failure handling is incomplete.
41-60: close to production; fix remaining high-risk gaps.
61+: strong production posture, assuming security and business logic are also reviewed.
```

## Final gate

Before production, answer these out loud:

```txt
Can this workflow replay without redoing unsafe work?
Can every side-effecting step run twice without damage?
Can a user refresh and still find their run?
Can an operator inspect exactly where it failed?
Can a permanent failure fail fast?
Can a transient failure recover?
Can a human or vendor resume the correct run securely?
Can a deployment happen without breaking callers or in-flight assumptions?
```

=== reference/quick_reference.md ===
# Workflow SDK Quick Reference

## Mental model

```txt
Workflow function = durable orchestration
Step function     = real side-effecting work
Event log         = persisted source of execution truth
Run ID            = durable handle for clients/operators
Hook              = typed external resume point
Webhook           = HTTP callback resume point
Stream            = incremental output/progress channel
DurableAgent      = workflow-backed agent loop
```

## Directives

```ts
export async function myWorkflow(input: Input) {
  "use workflow";
  const result = await doWork(input);
  return result;
}

async function doWork(input: Input) {
  "use step";
  return await provider.call(input);
}
```

## Workflow functions should

- Orchestrate steps.
- Use `await`, `if`, loops, `try/catch`, `Promise.all`, and `Promise.race`.
- Use `sleep()` for durable time waits.
- Create hooks/webhooks for external input.
- Return serializable results.

## Workflow functions should not

- Directly call databases.
- Directly call external APIs.
- Send emails/SMS.
- Charge/refund payments.
- Do file system work.
- Depend on request-lifetime timers.

Put that work in steps.

## Step functions should

- Do the actual work.
- Use full runtime access and npm packages.
- Be safe to retry.
- Use idempotency keys for unsafe side effects.
- Throw `FatalError` for permanent failures.
- Throw `RetryableError` or generic errors for transient failures.

## Start a workflow

```ts
import { start } from "workflow/api";

const run = await start(myWorkflow, [input]);

return Response.json(
  {
    runId: run.runId,
    status: await run.status,
  },
  { status: 202 },
);
```

## Get status/result

```ts
import { getRun } from "workflow/api";

const run = getRun(runId);

const status = await run.status;
const result = status === "completed" ? await run.returnValue : undefined;
```

## Idempotency

```ts
import { getStepMetadata } from "workflow";

async function chargeCustomer(input: ChargeInput) {
  "use step";

  const { stepId } = getStepMetadata();

  return await provider.charge({
    ...input,
    idempotencyKey: stepId,
  });
}
```

## Error classification

```ts
import { FatalError, RetryableError } from "workflow";

if (invalidInput) {
  throw new FatalError("Invalid input");
}

if (rateLimited) {
  throw new RetryableError("Rate limited", { retryAfter: "1m" });
}

if (temporaryProviderFailure) {
  throw new Error("Provider unavailable");
}
```

## Sleep

```ts
import { sleep } from "workflow";

await sleep("30s");
await sleep("10m");
await sleep("7d");
await sleep(new Date("2026-05-01T09:00:00.000Z"));
```

## Hook

```ts
import { createHook } from "workflow";
import { resumeHook } from "workflow/api";

// workflow
using approval = createHook<{ approved: boolean }>({
  token: `approval:${documentId}`,
});

const decision = await approval;

// route/server-side code
await resumeHook(`approval:${documentId}`, { approved: true });
```

## Hook with timeout

```ts
const decision = await Promise.race([
  approval,
  sleep("24h").then(() => ({ approved: false })),
]);
```

## Stream progress

```ts
import { getWritable } from "workflow";

async function emit(event: ProgressEvent) {
  "use step";

  const writer = getWritable<ProgressEvent>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}
```

## Resume stream

```ts
import { getRun } from "workflow/api";

const run = getRun(runId);
return new Response(run.getReadable({ startIndex }), {
  headers: { "content-type": "application/x-ndjson" },
});
```

## DurableAgent skeleton

```ts
import { DurableAgent } from "@workflow/ai/agent";
import { getWritable, getStepMetadata } from "workflow";
import { convertToModelMessages, type UIMessage, type UIMessageChunk } from "ai";
import { z } from "zod";

async function lookupOrder({ orderId }: { orderId: string }) {
  "use step";
  return await db.order.findUnique({ where: { id: orderId } });
}

async function refundOrder({ orderId }: { orderId: string }) {
  "use step";
  const { stepId } = getStepMetadata();
  return await payments.refund({ orderId, idempotencyKey: stepId });
}

export async function supportAgent(messages: UIMessage[]) {
  "use workflow";

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: "You are a careful support agent.",
    tools: {
      lookupOrder: {
        description: "Look up an order",
        inputSchema: z.object({ orderId: z.string() }),
        execute: lookupOrder,
      },
      refundOrder: {
        description: "Refund an order",
        inputSchema: z.object({ orderId: z.string() }),
        execute: refundOrder,
      },
    },
  });

  await agent.stream({
    messages: await convertToModelMessages(messages),
    writable: getWritable<UIMessageChunk>(),
  });
}
```

## CLI

```bash
npx workflow inspect runs
npx workflow inspect runs --web
npx workflow inspect runs --backend vercel
```

## Design rules worth memorizing

```txt
[ ] Every external side effect is in a step.
[ ] Every unsafe step has an idempotency key.
[ ] Permanent failures use FatalError.
[ ] Transient failures retry.
[ ] Long waits use sleep, hooks, or webhooks.
[ ] Long-running routes return runId.
[ ] Users can check status or reconnect to streams.
[ ] Hook tokens are deterministic and namespaced.
[ ] Streams release writer locks.
[ ] Workflow identity and input/output shapes are versioned carefully.
[ ] Tests cover runtime behavior, not just pure functions.
```

=== reference/references.md ===
# References

Official docs and sources used to build this workshop kit.

## Workflow SDK / Vercel Workflows

- Vercel Workflows product docs: https://vercel.com/docs/workflows
- GA announcement: https://vercel.com/blog/a-new-programming-model-for-durable-execution
- Workflow SDK docs: https://useworkflow.dev/docs
- Workflows and Steps: https://useworkflow.dev/docs/foundations/workflows-and-steps
- Idempotency: https://useworkflow.dev/docs/foundations/idempotency
- Hooks and Webhooks: https://useworkflow.dev/docs/foundations/hooks
- Streaming: https://useworkflow.dev/docs/foundations/streaming
- Testing: https://useworkflow.dev/docs/testing
- Deploying: https://useworkflow.dev/docs/deploying

## AI agents

- `@workflow/ai`: https://useworkflow.dev/docs/api-reference/workflow-ai
- DurableAgent: https://useworkflow.dev/docs/api-reference/workflow-ai/durable-agent
- WorkflowChatTransport: https://useworkflow.dev/docs/api-reference/workflow-ai/workflow-chat-transport
- Chat Session Modeling: https://useworkflow.dev/docs/ai/chat-session-modeling

## Suggested reading angle

Read these in this order if you have limited prep time:

1. Workflows and Steps
2. Idempotency
3. Hooks and Webhooks
4. Streaming
5. DurableAgent
6. WorkflowChatTransport
7. Testing
8. Deploying

=== reference/workflow_vs_alternatives.md ===
# Workflow SDK vs Alternatives

Use this matrix during Q&A or architecture review.

## Decision matrix

| Need | Request handler | Cron | Queue worker | DB status table | Workflow SDK |
|---|---:|---:|---:|---:|---:|
| Finish within one HTTP request | Excellent | Poor | Usually overkill | Usually overkill | Usually overkill |
| Run after user disconnects | Poor | Maybe | Good | Needs worker | Excellent |
| Multi-step business process | Poor | Poor | Medium | Medium | Excellent |
| Durable sleep for one run | Poor | Medium | Medium | Manual | Excellent |
| Wait for human approval | Poor | Poor | Manual | Manual | Excellent |
| Wait for vendor callback | Poor | Poor | Manual | Manual | Excellent |
| Automatic retries | Poor | Poor | Good | Manual | Excellent |
| Idempotency guidance | Manual | Manual | Manual | Manual | Built into step pattern |
| Progress streaming | Poor | Poor | Manual | Manual | Built in |
| Inspect execution history | Poor | Poor | Depends | Manual | Built in |
| AI agent stream recovery | Poor | Poor | Manual | Manual | DurableAgent pattern |

## When to choose a normal route

Choose a normal route when:

```txt
operation is synchronous
operation finishes quickly
no external side effect needs retry
a client can safely retry the whole request
no durable status is needed
```

Example:

```txt
GET /api/user-profile
POST /api/validate-form
```

## When to choose cron

Choose cron when:

```txt
work is periodic, not per-run stateful
it is acceptable to scan for due work
recovery is simple
```

Example:

```txt
nightly aggregate rebuild
weekly cleanup job
```

If cron starts building its own status transitions and retry tables, you probably want workflows.

## When to choose a queue worker

Choose a queue worker when:

```txt
one independent task needs async processing
message-level retry is enough
there is no complex waiting or human/vendor interaction
```

Example:

```txt
resize this image
send this single email
index this one document
```

If multiple queue messages need to coordinate a long-running process, you probably want workflows.

## When to choose Workflow SDK

Choose Workflow SDK when:

```txt
business process has multiple steps
state must survive deploys/crashes/timeouts
there are retries and unsafe side effects
work waits for time, humans, vendors, or model/tool loops
users need status or stream progress
operators need to inspect runs
```

Example:

```txt
refund approval
payment fulfillment
marketplace escrow
incident response
compliance request
RAG ingestion
DurableAgent support assistant
```

## The practical pitch

Do not say:

> Workflow SDK is better than queues.

Say:

> Workflow SDK prevents us from hand-building orchestration out of queues, cron, status tables, and retry glue.

## Architecture anti-patterns Workflow SDK replaces

### Queue spaghetti

```txt
route -> queue A -> worker A -> DB status -> queue B -> worker B -> cron retry -> callback route -> status table -> polling UI
```

### Workflow shape

```txt
route -> start(workflow) -> steps + sleep + hooks + streams -> getRun/inspect
```

## The hard truth

Workflow SDK does not remove the need for design. You still need:

```txt
idempotency
failure classification
secure resume endpoints
versioning discipline
tests
operator runbooks
```

It does make those concerns explicit in the code instead of hiding them across infrastructure.

