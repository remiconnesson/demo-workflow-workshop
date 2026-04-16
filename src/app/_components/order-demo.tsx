"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
} from "@/workflows/place-order";

const MENU: OrderItem[] = [
  { id: "deployer", name: "The Deployer", price: 4.5, qty: 0 },
  { id: "edge", name: "Edge Runtime", price: 4.5, qty: 0 },
  { id: "cold", name: "Cold Start", price: 3.5, qty: 0 },
  { id: "cruller", name: "Cron Cruller", price: 4.0, qty: 0 },
];

const STEPS: { key: string; label: string }[] = [
  { key: "validateOrder", label: "Validate order" },
  { key: "chargeCard", label: "Charge card" },
  { key: "pingRestaurant", label: "Ping restaurant" },
  { key: "findDriver", label: "Find driver" },
  { key: "trackDelivery", label: "Track delivery" },
  { key: "sendReceipts", label: "Send receipts" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "Happy path" },
  { value: "validateOrder", label: "Fail at validate" },
  { value: "chargeCard", label: "Fail at payment" },
  { value: "chargeCardRetryable", label: "Rate limit payment once" },
  { value: "pingRestaurant", label: "Fail at restaurant" },
  { value: "findDriver", label: "Fail at driver" },
  { value: "sendReceipts", label: "Fail at receipt" },
];

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

export default function OrderDemo() {
  const [cart, setCart] = useState<OrderItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "deployer" ? 1 : 0 })),
  );
  const [customerName, setCustomerName] = useState("Ada Lovelace");
  const [address, setAddress] = useState("123 Cupcake Lane, San Francisco");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [result, setResult] = useState<"completed" | "rolled_back" | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const total = useMemo(
    () => cart.reduce((s, i) => s + i.price * i.qty, 0),
    [cart],
  );
  const totalItems = useMemo(
    () => cart.reduce((s, i) => s + i.qty, 0),
    [cart],
  );

  const updateQty = (id: string, delta: number) =>
    setCart((c) =>
      c.map((i) =>
        i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i,
      ),
    );

  const reset = () => {
    abortRef.current?.abort();
    setEvents([]);
    setStepStatuses({});
    setResult(null);
    setCompensations([]);
    setCurrentOrderId(null);
  };

  const placeOrder = useCallback(async () => {
    reset();
    setRunning(true);

    const orderId = `ord_${Date.now().toString(36)}`;
    setCurrentOrderId(orderId);

    const input: OrderInput = {
      orderId,
      customerName,
      address,
      items: cart.filter((i) => i.qty > 0),
      failAt,
      autoAck,
    };

    const startRes = await fetch("/api/orders/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const { runId } = (await startRes.json()) as { runId: string };

    const controller = new AbortController();
    abortRef.current = controller;

    const res = await fetch(`/api/runs/${runId}/stream`, {
      signal: controller.signal,
    });
    if (!res.body) {
      setRunning(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as OrderEvent;
            applyEvent(event);
          } catch {
            // ignore non-json framing lines
          }
        }
      }
    } catch {
      // abort or stream ended
    } finally {
      setRunning(false);
    }
  }, [cart, customerName, address, failAt, autoAck]);

  const applyEvent = (event: OrderEvent) => {
    setEvents((ev) => [...ev, event]);
    switch (event.type) {
      case "step_running":
        setStepStatuses((s) => ({ ...s, [event.step]: "running" }));
        break;
      case "step_succeeded":
        setStepStatuses((s) => ({ ...s, [event.step]: "success" }));
        break;
      case "step_failed":
        setStepStatuses((s) => ({ ...s, [event.step]: "failed" }));
        break;
      case "step_skipped":
        setStepStatuses((s) => ({ ...s, [event.step]: "skipped" }));
        break;
      case "waiting_for_hook": {
        setStepStatuses((s) => ({ ...s, [event.step]: "waiting" }));
        if (autoAck) {
          const kind =
            event.step === "pingRestaurant"
              ? ("restaurant-accept" as const)
              : event.step === "findDriver"
                ? ("driver-accept" as const)
                : ("delivered" as const);
          setTimeout(() => {
            void resume(
              kind,
              kind === "delivered" ? {} : { accepted: true },
            );
          }, 800);
        }
        break;
      }
      case "hook_resolved":
        setStepStatuses((s) => ({ ...s, [event.step]: "success" }));
        break;
      case "compensated":
        setCompensations((c) => [...c, event.action]);
        break;
      case "done":
        setResult(event.status);
        break;
    }
  };

  const resume = async (
    kind: "restaurant-accept" | "driver-accept" | "delivered",
    payload: object = {},
  ) => {
    if (!currentOrderId) return;
    await fetch(`/api/orders/${currentOrderId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.3fr]">
      {/* LEFT COLUMN — order configuration */}
      <section className="space-y-4">
        <Card title="Menu">
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {cart.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {item.name}
                  </div>
                  <div className="text-sm text-zinc-500">
                    ${item.price.toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <QtyBtn onClick={() => updateQty(item.id, -1)}>−</QtyBtn>
                  <span className="w-6 text-center font-mono">{item.qty}</span>
                  <QtyBtn onClick={() => updateQty(item.id, 1)}>+</QtyBtn>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">
            <span className="text-zinc-500">
              {totalItems} {totalItems === 1 ? "item" : "items"}
            </span>
            <span className="font-semibold">${total.toFixed(2)}</span>
          </div>
        </Card>

        <Card title="Delivery details">
          <Field label="Customer">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            />
          </Field>
          <Field label="Address">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            />
          </Field>
        </Card>

        <Card title="Demo controls">
          <Field label="Scenario">
            <select
              value={failAt ?? "null"}
              onChange={(e) =>
                setFailAt(
                  e.target.value === "null"
                    ? null
                    : (e.target.value as FailStep),
                )
              }
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              {FAIL_OPTIONS.map((opt) => (
                <option key={String(opt.value)} value={opt.value ?? "null"}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={autoAck}
              onChange={(e) => setAutoAck(e.target.checked)}
            />
            Auto-ack restaurant / driver / delivery hooks
          </label>
          <p className="mt-1 text-xs text-zinc-500">
            Uncheck to drive the hooks manually from the Hook controls panel.
          </p>
        </Card>

        <div className="flex gap-2">
          <button
            onClick={placeOrder}
            disabled={running || total === 0}
            className="flex-1 rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {running ? "Running saga…" : "Place order"}
          </button>
          <button
            onClick={reset}
            disabled={running}
            className="rounded-md border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Reset
          </button>
        </div>
      </section>

      {/* RIGHT COLUMN — saga state + feed */}
      <section className="space-y-4">
        <Card
          title="Saga progress"
          right={
            result && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  result === "completed"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {result === "completed" ? "Completed" : "Rolled back"}
              </span>
            )
          }
        >
          <ol className="space-y-2">
            {STEPS.map((step) => {
              const status = stepStatuses[step.key] ?? "pending";
              return (
                <li
                  key={step.key}
                  className="flex items-center gap-3 text-sm"
                >
                  <StatusDot status={status} />
                  <span
                    className={
                      status === "pending"
                        ? "text-zinc-400"
                        : "text-zinc-900 dark:text-zinc-100"
                    }
                  >
                    {step.label}
                  </span>
                  <span className="ml-auto text-xs text-zinc-500">
                    {statusLabel(status)}
                  </span>
                </li>
              );
            })}
          </ol>
          {compensations.length > 0 && (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
              <div className="font-semibold">Compensations ran</div>
              <ul className="mt-1 list-disc pl-5">
                {compensations.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="Hook controls">
          <p className="mb-3 text-xs text-zinc-500">
            These call <code>resumeHook()</code> to wake the paused workflow.
            Only useful with auto-ack off.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <HookBtn onClick={() => resume("restaurant-accept", { accepted: true })}>
              Restaurant: accept
            </HookBtn>
            <HookBtn
              variant="danger"
              onClick={() =>
                resume("restaurant-accept", { accepted: false, reason: "86'd" })
              }
            >
              Restaurant: reject
            </HookBtn>
            <HookBtn onClick={() => resume("driver-accept", { accepted: true })}>
              Driver: accept
            </HookBtn>
            <HookBtn
              variant="danger"
              onClick={() => resume("driver-accept", { accepted: false })}
            >
              Driver: decline
            </HookBtn>
            <HookBtn onClick={() => resume("delivered")}>Mark delivered</HookBtn>
          </div>
        </Card>

        <Card title="Event stream">
          <div className="h-72 overflow-auto rounded-md bg-zinc-950 p-3 font-mono text-xs text-zinc-200">
            {events.length === 0 ? (
              <div className="text-zinc-500">No events yet.</div>
            ) : (
              events.map((e, i) => (
                <div key={i} className="whitespace-pre-wrap">
                  <span className="text-zinc-500">
                    {new Date().toLocaleTimeString()}{" "}
                  </span>
                  <span className={eventColor(e.type)}>{e.type}</span>{" "}
                  <span>{summarizeEvent(e)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

function statusLabel(s: StepStatus): string {
  switch (s) {
    case "running":
      return "running…";
    case "waiting":
      return "waiting for hook";
    case "success":
      return "ok";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    default:
      return "";
  }
}

function eventColor(type: OrderEvent["type"]): string {
  if (type === "step_failed" || type === "compensating") return "text-rose-400";
  if (type === "step_succeeded" || type === "hook_resolved" || type === "compensated")
    return "text-emerald-400";
  if (type === "waiting_for_hook") return "text-amber-300";
  if (type === "done") return "text-sky-300";
  return "text-zinc-400";
}

function summarizeEvent(e: OrderEvent): string {
  switch (e.type) {
    case "step_running":
    case "step_succeeded":
    case "step_failed":
    case "step_skipped":
      return `${e.label}${"detail" in e && e.detail ? ` — ${e.detail}` : ""}${
        "error" in e && e.error ? ` — ${e.error}` : ""
      }`;
    case "waiting_for_hook":
      return e.label;
    case "hook_resolved":
      return e.detail ?? e.token;
    case "compensation_pushed":
      return `${e.action} (for ${e.forStep})`;
    case "compensating":
    case "compensated":
      return e.action;
    case "log":
      return e.message;
    case "done":
      return `${e.status} — ${e.orderId}`;
    default:
      return "";
  }
}

function StatusDot({ status }: { status: StepStatus }) {
  const base = "h-2.5 w-2.5 rounded-full";
  const cls = {
    pending: "bg-zinc-300 dark:bg-zinc-700",
    running: "bg-sky-500 animate-pulse",
    waiting: "bg-amber-500 animate-pulse",
    success: "bg-emerald-500",
    failed: "bg-rose-500",
    skipped: "bg-zinc-400 opacity-50",
  }[status];
  return <span className={`${base} ${cls}`} />;
}

function Card({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-3 block first:mt-0">
      <span className="mb-1 block text-xs font-medium text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function QtyBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

function HookBtn({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  const cls =
    variant === "danger"
      ? "border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
      : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800";
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-xs font-medium ${cls}`}
    >
      {children}
    </button>
  );
}
