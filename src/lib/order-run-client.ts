"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderEvent, OrderInput } from "@/workflows/place-order";
import type { OrderStepId, SlideStepState } from "@/lib/order-contract";

export type ResumeBody =
  | { kind: "restaurant-accept"; accepted: boolean; reason?: string }
  | { kind: "driver-accept"; accepted: boolean }
  | { kind: "delivered"; photo?: string };

export type ScriptedResume = {
  step: Extract<
    OrderStepId,
    "notifyRestaurant" | "assignDriver" | "trackDelivery"
  >;
  delayMs?: number;
  body: ResumeBody;
};

export type OrderRunScenario = {
  scenarioId: string;
  title: string;
  subtitle?: string;
  autoStart?: boolean;
  input: Omit<OrderInput, "orderId">;
  scriptedResumes?: ScriptedResume[];
};

export type OrderRunController = {
  running: boolean;
  orderId: string | null;
  runId: string | null;
  events: OrderEvent[];
  stepState: Partial<Record<OrderStepId, SlideStepState>>;
  waitingOn: OrderStepId | null;
  compensations: string[];
  doneStatus: "completed" | "rolled_back" | null;
  autoResumeAt: number | null;
  resumeToast: string | null;
  error: string | null;
  start: () => Promise<void>;
  reset: (reason?: string) => void;
  resume: (body: ResumeBody) => Promise<void>;
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
  const [compensations, setCompensations] = useState<string[]>([]);
  const [doneStatus, setDoneStatus] = useState<
    "completed" | "rolled_back" | null
  >(null);
  const [autoResumeAt, setAutoResumeAt] = useState<number | null>(null);
  const [resumeToast, setResumeToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderIdRef = useRef<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const scheduledOrderIdRef = useRef<string | null>(null);
  const autoResumeTimeoutRef = useRef<number | null>(null);

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

  const reset = useCallback(
    (reason = "reset") => {
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
      clearScheduledResume(reason);
      setRunning(false);
      setOrderId(null);
      setRunId(null);
      setEvents([]);
      setStepState({});
      setWaitingOn(null);
      setCompensations([]);
      setDoneStatus(null);
      setResumeToast(null);
      setError(null);
      orderIdRef.current = null;
      console.info("[order-run] reset", {
        source,
        scenarioId: scenario.scenarioId,
        reason,
      });
    },
    [clearScheduledResume, scenario.scenarioId, source],
  );

  const applyEvent = useCallback(
    (event: OrderEvent) => {
      setEvents((current) => [...current, event]);
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
        case "step_failed":
          setStepState((current) => ({
            ...current,
            [event.step as OrderStepId]: "failed",
          }));
          break;
        case "step_skipped":
          setStepState((current) => ({
            ...current,
            [event.step as OrderStepId]: "skipped",
          }));
          break;
        case "waiting_for_hook": {
          const step = event.step as OrderStepId;
          setStepState((current) => ({ ...current, [step]: "waiting" }));
          setWaitingOn(step);

          const scripted = scenario.scriptedResumes?.find(
            (candidate) => candidate.step === step,
          );
          const body =
            scripted?.body ??
            (scenario.input.autoAck ? defaultResumeForStep(step) : null);
          if (!body) {
            setAutoResumeAt(null);
            break;
          }

          clearScheduledResume("reschedule");
          const delayMs = scripted?.delayMs ?? 800;
          const scheduledOrderId = orderIdRef.current;
          scheduledOrderIdRef.current = scheduledOrderId;
          setAutoResumeAt(performance.now() + delayMs);
          console.info("[order-run] auto_resume_scheduled", {
            source,
            scenarioId: scenario.scenarioId,
            orderId: scheduledOrderId,
            step,
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
          setDoneStatus(event.status);
          setRunning(false);
          setWaitingOn(null);
          break;
        default:
          break;
      }
    },
    [
      clearScheduledResume,
      resume,
      scenario.input.autoAck,
      scenario.scenarioId,
      scenario.scriptedResumes,
      source,
    ],
  );

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
        autoAck: input.autoAck ?? false,
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
    compensations,
    doneStatus,
    autoResumeAt,
    resumeToast,
    error,
    start,
    reset,
    resume,
  };
}
