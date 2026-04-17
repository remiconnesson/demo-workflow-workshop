# Audit: src/workflows/experiments/our-first-agent.ts

**Target:** `src/workflows/experiments/our-first-agent.ts`
**Audited:** 2026-04-17 03:53
**Status:** findings

The Act IV "first agent" demo workflow — wired live at `/api/experiments/our-first-agent/route.ts` and shown on slides `first-agent/demo`, `first-agent/solution`, `first-agent/pattern`. Composes `DurableAgent` + `getWritable` + `convertToModelMessages` per the canonical Chat SDK integration. Contains one structural error: `sleep()` is called inside a `"use step"` function, which the canonical docs and SDK runtime explicitly forbid.

## Findings

### 1. `DurableAgent` imported from `@workflow/ai/agent`

- **Verdict:** match
- **Severity:** n/a
- **Target location:** `src/workflows/experiments/our-first-agent.ts:1`
- **Canonical source:** `~/dev/workflow/packages/ai/package.json` (`"./agent"` subpath); `~/dev/workflow/docs/content/docs/cookbook/integrations/chat-sdk.mdx:37`
- **Claim:** `DurableAgent` lives at `@workflow/ai/agent`.
- **Reality:** Verified in rows 28 and 29.
- **Evidence:** packages/ai/package.json; chat-sdk.mdx:37.
- **Recommendation:** No change.

### 2. `getWritable, sleep` imported from `"workflow"`

- **Verdict:** match
- **Severity:** n/a
- **Target location:** `src/workflows/experiments/our-first-agent.ts:2`
- **Canonical source:** `~/dev/workflow/packages/core/src/index.ts:28, 38`
- **Claim:** `getWritable` and `sleep` are canonical exports of `"workflow"`.
- **Reality:** Verified in rows 27/28.
- **Evidence:** core/src/index.ts:28, :38.
- **Recommendation:** No change.

### 3. `convertToModelMessages, UIMessage, UIMessageChunk` imported from `"ai"`

- **Verdict:** match
- **Severity:** n/a
- **Target location:** `src/workflows/experiments/our-first-agent.ts:4-8`
- **Canonical source:** `~/dev/workflow/docs/content/docs/cookbook/integrations/chat-sdk.mdx:38, 108-110`
- **Claim:** The Chat SDK integration imports `convertToModelMessages` plus `UIMessage` and `UIMessageChunk` types from `"ai"`.
- **Reality:** Canonical Chat SDK integration import set, matches the canonical example verbatim.
- **Evidence:** chat-sdk.mdx:38, :108-110.
- **Recommendation:** No change.

### 4. `await sleep("3s")` inside a `"use step"` function — BLOCKER

- **Verdict:** mismatch
- **Severity:** blocker
- **Target location:** `src/workflows/experiments/our-first-agent.ts:19-25`
- **Canonical source:** `~/dev/workflow/docs/content/docs/ai/sleep-and-delays.mdx:63`; `~/dev/workflow/docs/content/docs/cookbook/agent-patterns/tool-orchestration.mdx:12`; `~/dev/workflow/skills/workflow/SKILL.md:177`; `~/dev/workflow/packages/core/src/sleep.ts:38-45`
- **Claim:** `fetchOrderDetails` is marked `"use step"` and calls `await sleep("3s")` inside its body.
- **Reality:** Three canonical sources state explicitly that `sleep()` cannot run inside a step:
  - `sleep-and-delays.mdx:63`: "the `sleep()` function must be called from within a workflow context, not from within a step. This is why `executeSleep` does not have `"use step"` - it runs in the workflow context where `sleep()` is available."
  - `tool-orchestration.mdx:12`: "Tools marked with `"use step"` get automatic retries and full Node.js access but cannot use `sleep()` or hooks. Tools without `"use step"` run in the workflow context and can use workflow primitives."
  - `SKILL.md:177`: "Tool `execute` functions that use workflow primitives (`sleep()`, `createHook()`) should **NOT** use `"use step"` — they run at the workflow level."
  
  Source confirms at `packages/core/src/sleep.ts:38-45`:
  ```ts
  export async function sleep(param: StringValue | Date | number): Promise<void> {
    const sleepFn = (globalThis as any)[WORKFLOW_SLEEP];
    if (!sleepFn) {
      throw new Error('`sleep()` can only be called inside a workflow function');
    }
    return sleepFn(param);
  }
  ```
  `WORKFLOW_SLEEP` is set on the workflow VM's `globalThis` (`packages/core/src/workflow.ts:198`); steps execute in a separate worker context where this symbol is not present. So the first time the agent calls `fetchOrderDetails`, the step's body throws `Error: 'sleep() can only be called inside a workflow function'`. The first-agent demo would crash on its first tool invocation — the very thing the slide is meant to showcase.
- **Evidence:** sleep-and-delays.mdx:63; tool-orchestration.mdx:12; SKILL.md:177; sleep.ts:38-45; workflow.ts:198.
- **Recommendation:** Remove the `"use step"` directive on line 20. The function then runs in the workflow context where `sleep()` is available, and durability is preserved by the workflow VM's event log (sleep timers + the agent's internal LLM step caching). The hardcoded return value is pure data, so re-execution on replay is a no-op.

### 5. `"use workflow"` on `ourFirstAgentWorkflow`

- **Verdict:** match
- **Severity:** n/a
- **Target location:** `src/workflows/experiments/our-first-agent.ts:39`
- **Canonical source:** `~/dev/workflow/docs/content/docs/how-it-works/understanding-directives.mdx:18, 41`
- **Claim:** Outer workflow function marked `"use workflow"`.
- **Reality:** Canonical directive placement.
- **Evidence:** understanding-directives.mdx:18.
- **Recommendation:** No change.

### 6. `new DurableAgent({ model, instructions, tools })` constructor

- **Verdict:** match
- **Severity:** n/a
- **Target location:** `src/workflows/experiments/our-first-agent.ts:43-63`
- **Canonical source:** `~/dev/workflow/docs/content/docs/api-reference/workflow-ai/durable-agent.mdx:17-55`; `~/dev/workflow/docs/content/docs/cookbook/integrations/chat-sdk.mdx:42-48`
- **Claim:** `DurableAgent` accepts `{ model, instructions, tools }` with `model: "anthropic/claude-haiku-4.5"`.
- **Reality:** Canonical constructor shape, matches the chat-sdk.mdx example.
- **Evidence:** durable-agent.mdx:17-55; chat-sdk.mdx:42-48.
- **Recommendation:** No change.

### 7. Tool shape `{ description, inputSchema: z.object({...}), execute }`

- **Verdict:** match
- **Severity:** n/a
- **Target location:** `src/workflows/experiments/our-first-agent.ts:53-62`
- **Canonical source:** `~/dev/workflow/docs/content/docs/ai/defining-tools.mdx`; AI SDK convention.
- **Claim:** Single tool follows `{ description, inputSchema: z.object({...}), execute }` shape.
- **Reality:** Canonical AI-SDK tool shape.
- **Evidence:** ai/defining-tools.mdx.
- **Recommendation:** No change.

### 8. `agent.stream({ messages: await convertToModelMessages(messages), writable })` — Chat SDK shape

- **Verdict:** match
- **Severity:** n/a
- **Target location:** `src/workflows/experiments/our-first-agent.ts:65-68`
- **Canonical source:** `~/dev/workflow/docs/content/docs/cookbook/integrations/chat-sdk.mdx:50-53`
- **Claim:** The agent stream is fed `convertToModelMessages(uiMessages)` and writes to `getWritable<UIMessageChunk>()`.
- **Reality:** Matches the canonical Chat SDK integration verbatim:
  ```ts
  const result = await agent.stream({
    messages: await convertToModelMessages(messages),
    writable: getWritable<UIMessageChunk>(),
  });
  ```
- **Evidence:** chat-sdk.mdx:50-53.
- **Recommendation:** No change.

## Summary

- Blockers: 1
- Minor: 0
- Stylistic: 0
- Ambiguous: 0
- Claims checked: 8

One blocker found: finding #4 — `await sleep("3s")` inside a `"use step"` function. Three independent canonical sources (`sleep-and-delays.mdx:63`, `tool-orchestration.mdx:12`, `SKILL.md:177`) and the SDK source itself (`sleep.ts:40-43`) confirm that `sleep()` throws when called outside the workflow VM context. The first-agent demo would crash on its first tool call. Surgical fix: remove the `"use step"` directive on line 20. Applying.
