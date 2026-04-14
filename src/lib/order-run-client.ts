"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderEvent, OrderInput } from "@/workflows/place-order";
import type { OrderStepId, SlideStepState } from "@/lib/order-contract";

export type ResumeBody =
  | { kind: "restaurant-accept"; accepted: boolean; reason?: string }
  | { kind: "driver-accept"; accepted: boolean }
  | { kind: "delivered"; photo?: string };

type HookStep = Extract<
  OrderStepId,
  "notifyRestaurant" | "assignDriver" | "trackDelivery"
>;

export type ScriptedResume = {
  step: HookStep;
  delayMs?: number;
  body: ResumeBody;
};

export type WaitStrategy = "manual" | "silent" | "autoAck" | "scripted";

export type ScheduledResume = {
  step: HookStep;
  at: number;
  body: ResumeBody;
  source: "autoAck" | "scripted";
};

export type OrderRunScenario = {
  scenarioId: string;
  title: string;
  subtitle?: string;
  autoStart?: boolean;
  input: Omit<OrderInput, "orderId">;
  scriptedResumes?: ScriptedResume[];
  silentWaitingSteps?: HookStep[];
};

export type CrashPhase = "live" | "crashed" | "replaying";

export type OrderRunController = {
  running: boolean;
  orderId: string | null;
  runId: string | null;
  events: OrderEvent[];
  stepState: Partial<Record<OrderStepId, SlideStepState>>;
  waitingOn: OrderStepId | null;
  waitStrategy: WaitStrategy | null;
  compensations: string[];
  doneStatus: "completed" | "rolled_back" | null;
  autoResumeAt: number | null;
  scheduledResume: ScheduledResume | null;
  resumeToast: string | null;
  error: string | null;
  adminCancelReady: boolean;
  crashPhase: CrashPhase;
  crashMessage: string | null;
  start: () => Promise<void>;
  reset: (reason?: string) => void;
  resume: (body: ResumeBody) => Promise<void>;
  crash: () => Promise<void>;
  adminCancel: (reason?: string) => Promise<void>;
};

function makeOrderId(source: string, scenarioId: string): string {
  const safeSource = source.replaceAll("/", "_");
  return `ord_${safeSource}_${scenarioId}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultResumeForStep(step: OrderStepId): ResumeBody | null {
  switch (step) {
    case "notifyRestaurant":
      return { kind: "restaurant-accept", accepted: true };
    case "assignDriver":
      return { kind: "driver-accept", accepted: true };
    case "trackDelivery":
      return { kind: "delivered" };
    default:
      return null;
  }
}

export function useOrderRun(
  source: string,
  scenario: OrderRunScenario,
): OrderRunController {
  const [running, setRunning] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepState, setStepState] = useState<
    Partial<Record<OrderStepId, SlideStepState>>
  >({});
  const [waitingOn, setWaitingOn] = useState<OrderStepId | null>(null);
  const [waitStrategy, setWaitStrategy] = useState<WaitStrategy | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);
  const [doneStatus, setDoneStatus] = useState<
    "completed" | "rolled_back" | null
  >(null);
  const [autoResumeAt, setAutoResumeAt] = useState<number | null>(null);
  const [scheduledResume, setScheduledResume] =
    useState<ScheduledResume | null>(null);
  const [resumeToast, setResumeToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminCancelReady, setAdminCancelReady] = useState(false);
  const [crashPhase, setCrashPhase] = useState<CrashPhase>("live");
  const [crashMessage, setCrashMessage] = useState<string | null>(null);

  const orderIdRef = useRef<string | null>(null);
  const waitingOnRef = useRef<OrderStepId | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const scheduledOrderIdRef = useRef<string | null>(null);
  const autoResumeTimeoutRef = useRef<number | null>(null);
  const eventsRef = useRef<OrderEvent[]>([]);
  const crashPhaseRef = useRef<CrashPhase>("live");
  const replayTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    waitingOnRef.current = waitingOn;
  }, [waitingOn]);

  useEffect(() => {
    crashPhaseRef.current = crashPhase;
  }, [crashPhase]);

  const clearScheduledResume = useCallback(
    (reason: string) => {
      if (autoResumeTimeoutRef.current !== null) {
        window.clearTimeout(autoResumeTimeoutRef.current);
        autoResumeTimeoutRef.current = null;
        console.info("[order-run] auto_resume_cleared", {
          source,
          scenarioId: scenario.scenarioId,
          reason,
        });
      }
      scheduledOrderIdRef.current = null;
      setAutoResumeAt(null);
      setScheduledResume(null);
    },
    [scenario.scenarioId, source],
  );

  const resume = useCallback(
    async (body: ResumeBody) => {
      const currentOrderId = orderIdRef.current;
      if (!currentOrderId) return;
      console.info("[order-run] resume_requested", {
        source,
        scenarioId: scenario.scenarioId,
        orderId: currentOrderId,
        body,
      });
      const response = await fetch(
        `/api/orders/${currentOrderId}/resume`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        throw new Error(`resume failed: ${response.status}`);
      }
    },
    [scenario.scenarioId, source],
  );

  const adminCancel = useCallback(
    async (reason?: string) => {
      const currentOrderId = orderIdRef.current;
      if (!currentOrderId) return;
      setError(null);
      console.info("[order-run] admin_cancel_requested", {
        source,
        scenarioId: scenario.scenarioId,
        orderId: currentOrderId,
        reason,
      });
      const response = await fetch(
        `/api/orders/${currentOrderId}/admin-cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason ?? "support" }),
        },
      );
      if (!response.ok) {
        let message = `admin-cancel failed: ${response.status}`;
        try {
          const body = (await response.json()) as { error?: string };
          if (body.error) {
            message = body.error;
          }
        } catch {
          // Ignore JSON parse failures and fall back to status text.
        }
        setError(message);
        console.warn("[order-run] admin_cancel_rejected", {
          source,
          scenarioId: scenario.scenarioId,
          orderId: currentOrderId,
          status: response.status,
          message,
        });
        return;
      }
    },
    [scenario.scenarioId, source],
  );

  const reset = useCallback(
    (reason = "reset") => {
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
      clearScheduledResume(reason);
      for (const t of replayTimeoutsRef.current) {
        window.clearTimeout(t);
      }
      replayTimeoutsRef.current = [];
      setRunning(false);
      setOrderId(null);
      setRunId(null);
      setEvents([]);
      eventsRef.current = [];
      setStepState({});
      setWaitingOn(null);
      setWaitStrategy(null);
      setCompensations([]);
      setDoneStatus(null);
      setResumeToast(null);
      setError(null);
      setAdminCancelReady(false);
      setCrashPhase("live");
      crashPhaseRef.current = "live";
      setCrashMessage(null);
      orderIdRef.current = null;
      console.info("[order-run] reset", {
        source,
        scenarioId: scenario.scenarioId,
        reason,
      });
    },
    [clearScheduledResume, scenario.scenarioId, source],
  );

  const applyDerivedState = useCallback(
    (event: OrderEvent) => {
      switch (event.type) {
        case "step_running":
          setStepState((current) => ({
            ...current,
            [event.step as OrderStepId]: "running",
          }));
          break;
        case "step_succeeded":
          setStepState((current) => ({
            ...current,
            [event.step as OrderStepId]: "success",
          }));
          setWaitingOn((current) =>
            current === event.step ? null : current,
          );
          break;
        case "step_failed": {
          const failedStep = event.step as OrderStepId;
          setStepState((current) => ({
            ...current,
            [failedStep]: "failed",
          }));
          if (waitingOnRef.current === failedStep) {
            clearScheduledResume("step_failed");
            setWaitingOn(null);
            setWaitStrategy(null);
            console.info("[order-run] wait_cleared_on_failure", {
              source,
              scenarioId: scenario.scenarioId,
              orderId: orderIdRef.current,
              step: failedStep,
            });
          }
          break;
        }
        case "step_skipped":
          setStepState((current) => ({
            ...current,
            [event.step as OrderStepId]: "skipped",
          }));
          break;
        case "waiting_for_hook": {
          const step = event.step as HookStep;
          setAdminCancelReady(false);
          setStepState((current) => ({ ...current, [step]: "waiting" }));
          setWaitingOn(step);

          const scripted = scenario.scriptedResumes?.find(
            (candidate) => candidate.step === step,
          );
          const strategy: WaitStrategy = scripted
            ? "scripted"
            : scenario.input.autoAck
              ? "autoAck"
              : scenario.silentWaitingSteps?.includes(step)
                ? "silent"
                : "manual";
          setWaitStrategy(strategy);

          const body =
            strategy === "scripted"
              ? scripted!.body
              : strategy === "autoAck"
                ? defaultResumeForStep(step)
                : null;
          if (!body) {
            setAutoResumeAt(null);
            setScheduledResume(null);
            console.info("[order-run] wait_strategy", {
              source,
              scenarioId: scenario.scenarioId,
              orderId: orderIdRef.current,
              step,
              strategy,
              driverTimeout:
                step === "assignDriver"
                  ? (scenario.input.driverTimeout ?? "2m")
                  : undefined,
            });
            break;
          }

          clearScheduledResume("reschedule");
          const delayMs = scripted?.delayMs ?? 800;
          const scheduledOrderId = orderIdRef.current;
          const at = performance.now() + delayMs;
          const scheduledSource: ScheduledResume["source"] = strategy as
            | "scripted"
            | "autoAck";
          scheduledOrderIdRef.current = scheduledOrderId;
          setAutoResumeAt(at);
          setScheduledResume({
            step,
            at,
            body,
            source: scheduledSource,
          });
          console.info("[order-run] wait_strategy", {
            source,
            scenarioId: scenario.scenarioId,
            orderId: scheduledOrderId,
            step,
            strategy,
            delayMs,
            body,
          });
          autoResumeTimeoutRef.current = window.setTimeout(() => {
            const activeOrderId = orderIdRef.current;
            if (
              !scheduledOrderId ||
              scheduledOrderId !== activeOrderId
            ) {
              console.info("[order-run] auto_resume_stale", {
                source,
                scenarioId: scenario.scenarioId,
                scheduledOrderId,
                activeOrderId,
                step,
              });
              return;
            }
            console.info("[order-run] auto_resume_sent", {
              source,
              scenarioId: scenario.scenarioId,
              orderId: activeOrderId,
              step,
              body,
            });
            void resume(body);
          }, delayMs);
          break;
        }
        case "hook_resolved":
          clearScheduledResume("hook_resolved");
          setAdminCancelReady(false);
          setWaitStrategy(null);
          setStepState((current) => ({
            ...current,
            [event.step as OrderStepId]: "success",
          }));
          setWaitingOn((current) =>
            current === event.step ? null : current,
          );
          setResumeToast(event.detail ?? event.step);
          break;
        case "compensated":
          setCompensations((current) => [...current, event.action]);
          break;
        case "done":
          clearScheduledResume("done");
          setAdminCancelReady(false);
          setWaitStrategy(null);
          setDoneStatus(event.status);
          setRunning(false);
          setWaitingOn(null);
          break;
        case "log":
          if (
            event.message === "Admin cancel window open — sleeping 6s before dispatch"
          ) {
            setAdminCancelReady(true);
          } else if (
            event.message.startsWith("Admin cancel signal received:") ||
            event.message === "Support cancel window closed, continuing to dispatch"
          ) {
            setAdminCancelReady(false);
          }
          break;
        default:
          break;
      }
    },
    [
      clearScheduledResume,
      resume,
      scenario.input.autoAck,
      scenario.input.driverTimeout,
      scenario.scenarioId,
      scenario.scriptedResumes,
      scenario.silentWaitingSteps,
      source,
    ],
  );

  const applyEvent = useCallback(
    (event: OrderEvent) => {
      setEvents((current) => {
        const next = [...current, event];
        eventsRef.current = next;
        return next;
      });
      // During crash/replay, new live events are buffered but not applied
      // to derived state. The replay loop re-applies from eventsRef at
      // its own pace; live events that land in the meantime will get
      // picked up once the phase returns to "live".
      if (crashPhaseRef.current === "live") {
        applyDerivedState(event);
      }
    },
    [applyDerivedState],
  );

  const crash = useCallback(async () => {
    if (crashPhaseRef.current !== "live") return;
    if (!orderIdRef.current) return;
    console.info("[order-run] crash_simulated", {
      source,
      scenarioId: scenario.scenarioId,
      orderId: orderIdRef.current,
      bufferedEvents: eventsRef.current.length,
    });

    // Fire a real server-side crash when the scenario enables it. The
    // /api/orders/[orderId]/crash route resumes the crash-inject hook
    // and calls Run.wakeUp(), which drives the workflow's inter-step
    // Promise.race into the crash branch. The workflow throws a plain
    // Error → runtime retries → replays from the event log. Visible in
    // `npx workflow web`. Failures here are logged but never abort the
    // on-stage UI replay, which stays load-bearing for the visual beat.
    if (scenario.input.demoMode === "crashInjectable") {
      try {
        const response = await fetch(
          `/api/orders/${orderIdRef.current}/crash`,
          { method: "POST", headers: { "Content-Type": "application/json" } },
        );
        if (!response.ok) {
          let message = `crash-inject failed: ${response.status}`;
          try {
            const body = (await response.json()) as { error?: string };
            if (body.error) message = body.error;
          } catch {
            // Ignore JSON parse failure and fall back to status text.
          }
          console.warn("[order-run] crash_inject_rejected", {
            source,
            scenarioId: scenario.scenarioId,
            orderId: orderIdRef.current,
            status: response.status,
            message,
          });
        }
      } catch (caught) {
        console.warn("[order-run] crash_inject_failed", {
          source,
          scenarioId: scenario.scenarioId,
          orderId: orderIdRef.current,
          message: caught instanceof Error ? caught.message : String(caught),
        });
      }
    }

    // Stop any pending auto-resume timers — a "dead" process can't
    // schedule things. The real workflow on the server keeps running.
    clearScheduledResume("crash_simulated");

    // Wipe derived UI state. The event buffer stays — that's the log
    // we'll replay from in a moment.
    setCrashPhase("crashed");
    crashPhaseRef.current = "crashed";
    setCrashMessage("process terminated");
    setStepState({});
    setWaitingOn(null);
    setWaitStrategy(null);
    setCompensations([]);
    setResumeToast(null);
    setDoneStatus(null);

    // Pause for the audience, then begin the replay.
    await new Promise<void>((resolve) => {
      const t = window.setTimeout(resolve, 700);
      replayTimeoutsRef.current.push(t);
    });

    setCrashPhase("replaying");
    crashPhaseRef.current = "replaying";
    setCrashMessage("runtime reconstructing from event log");

    const snapshot = [...eventsRef.current];
    const REPLAY_STEP_MS = 55;
    for (let i = 0; i < snapshot.length; i += 1) {
      await new Promise<void>((resolve) => {
        const t = window.setTimeout(resolve, REPLAY_STEP_MS);
        replayTimeoutsRef.current.push(t);
      });
      applyDerivedState(snapshot[i]);
    }

    // Any live events that arrived during the crash/replay window
    // were appended to the buffer but skipped derived state. Apply
    // anything we missed now.
    const tail = eventsRef.current.slice(snapshot.length);
    for (const event of tail) {
      applyDerivedState(event);
    }

    setCrashPhase("live");
    crashPhaseRef.current = "live";
    setCrashMessage(null);
    console.info("[order-run] crash_replay_complete", {
      source,
      scenarioId: scenario.scenarioId,
      orderId: orderIdRef.current,
      replayed: snapshot.length,
      tail: tail.length,
    });
  }, [
    applyDerivedState,
    clearScheduledResume,
    scenario.input.demoMode,
    scenario.scenarioId,
    source,
  ]);

  const start = useCallback(async () => {
    reset("restart");
    setRunning(true);

    const nextOrderId = makeOrderId(source, scenario.scenarioId);
    const input: OrderInput = { ...scenario.input, orderId: nextOrderId };
    console.info("[order-run] start", {
      source,
      scenarioId: scenario.scenarioId,
      input: {
        orderId: input.orderId,
        failAt: input.failAt ?? null,
        autoAck: input.autoAck ?? true,
        demoMode: input.demoMode ?? "standard",
        driverTimeout: input.driverTimeout ?? "2m",
        itemCount: input.items.length,
      },
    });

    try {
      const startResponse = await fetch("/api/orders/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!startResponse.ok) {
        throw new Error(`start failed: ${startResponse.status}`);
      }
      const started = (await startResponse.json()) as {
        runId: string;
        orderId: string;
      };
      setRunId(started.runId);
      setOrderId(started.orderId);
      orderIdRef.current = started.orderId;

      const controller = new AbortController();
      streamAbortRef.current = controller;
      const streamResponse = await fetch(
        `/api/runs/${started.runId}/stream`,
        { signal: controller.signal },
      );
      if (!streamResponse.ok || !streamResponse.body) {
        throw new Error(`stream failed: ${streamResponse.status}`);
      }
      console.info("[order-run] stream_open", {
        source,
        scenarioId: scenario.scenarioId,
        runId: started.runId,
      });

      const reader = streamResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as OrderEvent;
          applyEvent(event);
        }
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        return;
      }
      const message =
        caught instanceof Error ? caught.message : String(caught);
      setError(message);
      setRunning(false);
      clearScheduledResume("error");
      console.error("[order-run] failed", {
        source,
        scenarioId: scenario.scenarioId,
        message,
      });
    }
  }, [applyEvent, clearScheduledResume, reset, scenario, source]);

  // auto-dismiss resume toast
  useEffect(() => {
    if (!resumeToast) return;
    const timeout = window.setTimeout(() => setResumeToast(null), 1400);
    return () => window.clearTimeout(timeout);
  }, [resumeToast]);

  // cleanup on unmount
  useEffect(() => () => reset("unmount"), [reset]);

  return {
    running,
    orderId,
    runId,
    events,
    stepState,
    waitingOn,
    waitStrategy,
    compensations,
    doneStatus,
    autoResumeAt,
    scheduledResume,
    resumeToast,
    error,
    adminCancelReady,
    crashPhase,
    crashMessage,
    start,
    reset,
    resume,
    crash,
    adminCancel,
  };
}
