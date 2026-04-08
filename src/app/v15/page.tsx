"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
} from "@/workflows/place-order";

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

const MENU: OrderItem[] = [
  { id: "deployer", name: "The Deployer", price: 4.0, qty: 0 },
  { id: "edge", name: "Edge Runtime", price: 5.5, qty: 0 },
  { id: "coldstart", name: "Cold Start", price: 4.5, qty: 0 },
  { id: "hotmodule", name: "Hot Module", price: 6.0, qty: 0 },
  { id: "sprinkle", name: "Serverless Sprinkle", price: 5.0, qty: 0 },
];

const STEPS = [
  { key: "validateOrder", label: "Dough check" },
  { key: "chargePayment", label: "Payment" },
  { key: "notifyRestaurant", label: "Baking" },
  { key: "assignDriver", label: "Courier dispatched" },
  { key: "trackDelivery", label: "En route" },
  { key: "sendReceipt", label: "Delivered" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "Happy path" },
  { value: "validateOrder", label: "Fail at dough check" },
  { value: "chargePayment", label: "Fail at payment" },
  { value: "notifyRestaurant", label: "Fail at baking" },
  { value: "assignDriver", label: "Fail at courier" },
  { value: "sendReceipt", label: "Fail at receipt" },
];

type StepStatus =
  | "pending"
  | "running"
  | "waiting"
  | "success"
  | "failed"
  | "skipped";

const Triangle = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2L22 20H2Z" />
  </svg>
);

export default function V15Page() {
  const [view, setView] = useState<"menu" | "tracking">("menu");
  const [cart, setCart] = useState<OrderItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "deployer" ? 1 : 0 }))
  );
  const [customerName, setCustomerName] = useState("Guillermo");
  const [address, setAddress] = useState("Vercel HQ, San Francisco");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>(
    {}
  );
  const [result, setResult] = useState<"completed" | "rolled_back" | null>(
    null
  );
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const total = useMemo(
    () => cart.reduce((s, i) => s + i.price * i.qty, 0),
    [cart]
  );

  const updateQty = (id: string, delta: number) =>
    setCart((c) =>
      c.map((i) =>
        i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i
      )
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
    setView("tracking");

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
            // ignore
          }
        }
      }
    } catch {
      // abort
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
            event.step === "notifyRestaurant"
              ? ("restaurant-accept" as const)
              : event.step === "assignDriver"
              ? ("driver-accept" as const)
              : ("delivered" as const);
          setTimeout(() => {
            void resume(kind, kind === "delivered" ? {} : { accepted: true });
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
    payload: object = {}
  ) => {
    if (!currentOrderId) return;
    await fetch(`/api/orders/${currentOrderId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
  };

  const statusLabel = (s: StepStatus): string => {
    switch (s) {
      case "running":
        return "Processing...";
      case "waiting":
        return "Waiting...";
      case "success":
        return "Done";
      case "failed":
        return "Failed";
      case "skipped":
        return "Skipped";
      default:
        return "Pending";
    }
  };

  const summarizeEvent = (e: OrderEvent): string => {
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
  };

  return (
    <div
      className={`min-h-screen bg-black text-white flex flex-col xl:flex-row ${geist.className}`}
    >
      {/* LEFT COLUMN: Phone Mockup */}
      <div className="w-full xl:w-[500px] shrink-0 flex items-center justify-center p-8 bg-[#0a0a0a] border-b xl:border-b-0 xl:border-r border-[rgba(255,255,255,0.1)] relative z-10">
        <div className="relative mx-auto w-[360px] h-[780px] bg-white rounded-[50px] border-[12px] border-zinc-900 shadow-2xl overflow-hidden flex flex-col shrink-0">
          {/* Dynamic Island */}
          <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-50 pointer-events-none">
            <div className="w-[110px] h-[25px] bg-zinc-900 rounded-b-[18px]"></div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pt-14 pb-8 text-black selection:bg-black selection:text-white flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 bg-black flex items-center justify-center rounded-lg shadow-sm">
                <Triangle className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold tracking-tight text-lg">
                Triangle Donuts
              </span>
            </div>

            {view === "menu" ? (
              <div className="space-y-8 flex-1 flex flex-col">
                <div className="space-y-4">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                    Menu
                  </h2>
                  <div className="divide-y divide-zinc-100 border-t border-b border-zinc-100">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="py-4 flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-medium text-sm text-zinc-900">
                            {item.name}
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5">
                            ${item.price.toFixed(2)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 opacity-100">
                          <button
                            className="w-7 h-7 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:text-black hover:border-black transition-colors"
                            onClick={() => updateQty(item.id, -1)}
                          >
                            −
                          </button>
                          <span
                            className={`text-sm w-4 text-center font-medium ${geistMono.className}`}
                          >
                            {item.qty}
                          </span>
                          <button
                            className="w-7 h-7 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:text-black hover:border-black transition-colors"
                            onClick={() => updateQty(item.id, 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium pt-2">
                    <span className="text-zinc-500">Subtotal</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                    Delivery Info
                  </h2>
                  <div className="space-y-3">
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-shadow placeholder:text-zinc-400"
                      placeholder="Name"
                    />
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-shadow placeholder:text-zinc-400"
                      placeholder="Address"
                    />
                  </div>
                </div>

                <button
                  onClick={placeOrder}
                  disabled={total === 0}
                  className="w-full bg-black text-white font-medium py-4 rounded-2xl text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-auto"
                >
                  Checkout <Triangle className="w-3 h-3 rotate-90" />
                </button>
              </div>
            ) : (
              <div className="space-y-8 flex flex-col flex-1">
                <div>
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-6">
                    Order Status
                  </h2>
                  <div className="space-y-8 relative">
                    <div className="absolute left-[7px] top-4 bottom-4 w-[2px] bg-zinc-100" />
                    {STEPS.map((step, idx) => {
                      const status = stepStatuses[step.key] ?? "pending";
                      const isActive =
                        status === "running" || status === "waiting";
                      const isPast = status === "success";
                      const isFailed = status === "failed";
                      const isSkipped = status === "skipped";

                      let color = "text-zinc-400";
                      if (isActive) color = "text-black";
                      if (isPast) color = "text-black";
                      if (isFailed) color = "text-[#ee0000]";
                      if (isSkipped) color = "text-zinc-300";

                      let icon = (
                        <div className="w-4 h-4 rounded-full bg-white border-2 border-zinc-200" />
                      );
                      if (isActive)
                        icon = (
                          <div className="w-4 h-4 rounded-full bg-white border-2 border-black flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-black rounded-full animate-pulse" />
                          </div>
                        );
                      if (isPast)
                        icon = (
                          <div className="w-4 h-4 bg-black rounded-full flex items-center justify-center">
                            <Triangle className="w-2 h-2 text-white" />
                          </div>
                        );
                      if (isFailed)
                        icon = (
                          <div className="w-4 h-4 bg-[#ee0000] rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                            ×
                          </div>
                        );

                      return (
                        <div
                          key={step.key}
                          className={`flex items-center gap-5 relative z-10 ${color}`}
                        >
                          <div className="w-4 flex justify-center shrink-0">
                            {icon}
                          </div>
                          <div
                            className={`text-sm ${
                              isActive || isPast ? "font-medium" : ""
                            }`}
                          >
                            {step.label}
                          </div>
                          <div className="ml-auto text-xs opacity-70">
                            {statusLabel(status)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-auto pt-8">
                  {result ? (
                    <div className="text-center space-y-5">
                      <div
                        className={`inline-flex items-center justify-center w-14 h-14 rounded-full border ${
                          result === "completed"
                            ? "bg-white border-zinc-200 text-black"
                            : "bg-white border-rose-100 text-[#ee0000]"
                        }`}
                      >
                        {result === "completed" ? (
                          <Triangle className="w-6 h-6" />
                        ) : (
                          <div className="w-5 h-5 bg-current rounded-sm" />
                        )}
                      </div>
                      <div className="font-semibold text-lg">
                        {result === "completed"
                          ? "Order Delivered"
                          : "Order Cancelled"}
                      </div>
                      <button
                        onClick={() => {
                          reset();
                          setView("menu");
                        }}
                        className="w-full bg-zinc-100 text-black font-medium py-4 rounded-2xl text-sm hover:bg-zinc-200 transition-colors"
                      >
                        Start New Order
                      </button>
                    </div>
                  ) : (
                    <div className="bg-zinc-50 rounded-2xl p-4 flex items-center justify-between border border-zinc-100 shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center overflow-hidden relative">
                           <div className="absolute inset-0 bg-black animate-pulse opacity-5" />
                           <Triangle className="w-4 h-4 text-zinc-500" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                            Status
                          </div>
                          <div className="text-sm font-medium">
                            {running ? "Processing..." : "Waiting"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Dashboard */}
      <div className="flex-1 bg-black relative p-6 xl:p-12 flex flex-col overflow-y-auto">
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundSize: "32px 32px",
            backgroundImage:
              "linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)",
          }}
        ></div>

        <div className="relative z-10 w-full max-w-5xl mx-auto space-y-10">
          <div className="flex flex-col gap-2 border-b border-[rgba(255,255,255,0.1)] pb-6">
            <div className="flex items-center gap-3">
              <Triangle className="w-5 h-5 text-white" />
              <h1 className="text-xl font-semibold tracking-tight">
                Vercel Workflow Console
              </h1>
            </div>
            <p className="text-sm text-zinc-400">
              Durable execution dashboard for Triangle Donuts saga
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
            <div className="space-y-8">
              {/* Saga Visualization */}
              <div className="border border-[rgba(255,255,255,0.1)] bg-black/40 backdrop-blur-xl p-6 lg:p-8 rounded-2xl">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-8">
                  Execution Topology
                </h3>
                <div className="flex items-center justify-between relative px-2">
                  <div className="absolute top-1/2 left-6 right-6 h-[1px] bg-[rgba(255,255,255,0.1)] -translate-y-1/2" />

                  {STEPS.map((step) => {
                    const status = stepStatuses[step.key] ?? "pending";
                    const isPast = status === "success";
                    const isActive =
                      status === "running" || status === "waiting";
                    const isFailed = status === "failed";
                    const isSkipped = status === "skipped";

                    let bg = "bg-[#111] border-[rgba(255,255,255,0.15)]";
                    let text = "text-zinc-600";

                    if (isPast) {
                      bg = "bg-white border-white shadow-[0_0_10px_rgba(255,255,255,0.3)]";
                      text = "text-white";
                    } else if (isActive) {
                      bg =
                        "bg-black border-[#0070f3] shadow-[0_0_15px_rgba(0,112,243,0.4)]";
                      text = "text-[#0070f3]";
                    } else if (isFailed) {
                      bg =
                        "bg-[#ee0000] border-[#ee0000] shadow-[0_0_15px_rgba(238,0,0,0.4)]";
                      text = "text-[#ee0000]";
                    } else if (isSkipped) {
                      bg =
                        "bg-transparent border-dashed border-[rgba(255,255,255,0.1)]";
                      text = "text-zinc-700";
                    }

                    return (
                      <div
                        key={step.key}
                        className="relative z-10 flex flex-col items-center gap-4"
                      >
                        <div
                          className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-all duration-300 ${bg}`}
                        >
                          {isPast && (
                            <Triangle className="w-4 h-4 text-black" />
                          )}
                          {isActive && (
                            <div className="w-2.5 h-2.5 rounded-full bg-[#0070f3] animate-pulse" />
                          )}
                          {isFailed && (
                            <div className="w-1 h-4 bg-white rotate-45 rounded-full relative">
                               <div className="absolute inset-0 bg-white -rotate-90 rounded-full" />
                            </div>
                          )}
                        </div>
                        <div
                          className={`absolute top-14 whitespace-nowrap text-[10px] font-medium ${geistMono.className} ${text}`}
                        >
                          {step.key}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-20 h-8 flex flex-col items-center justify-center">
                  {result && (
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
                        result === "completed"
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-[#ee0000]/10 border-[#ee0000]/20 text-[#ee0000]"
                      }`}
                    >
                      {result === "completed" ? (
                         <>
                            <Triangle className="w-3 h-3" />
                            WORKFLOW COMPLETED
                         </>
                      ) : (
                         <>
                            <div className="w-2 h-2 bg-current rounded-sm" />
                            WORKFLOW ROLLED BACK
                         </>
                      )}
                    </div>
                  )}
                  {compensations.length > 0 && (
                    <div className="mt-4 text-[11px] text-zinc-400 font-medium">
                      Compensations:{" "}
                      <span className="text-[#ee0000] ml-1">
                        {compensations.join(" → ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Raw Event Feed */}
              <div className="border border-[rgba(255,255,255,0.1)] bg-black/40 backdrop-blur-xl p-6 rounded-2xl h-[380px] flex flex-col">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4 shrink-0">
                  Event Stream
                </h3>
                <div
                  className={`flex-1 overflow-y-auto text-[11px] leading-relaxed ${geistMono.className}`}
                >
                  {events.length === 0 ? (
                    <div className="text-zinc-600 mt-2">
                      // Awaiting execution events...
                    </div>
                  ) : (
                    events.map((e, i) => {
                      let typeColor = "text-zinc-400";
                      if (
                        e.type === "step_failed" ||
                        e.type === "compensating"
                      )
                        typeColor = "text-[#ee0000]";
                      if (
                        e.type === "step_succeeded" ||
                        e.type === "hook_resolved" ||
                        e.type === "compensated"
                      )
                        typeColor = "text-white";
                      if (e.type === "waiting_for_hook")
                        typeColor = "text-[#0070f3]";
                      if (e.type === "done")
                        typeColor = "text-[#0070f3] font-bold";

                      return (
                        <div
                          key={i}
                          className="mb-1.5 flex gap-4 hover:bg-white/5 px-2 py-1 -ml-2 rounded"
                        >
                          <span className="text-zinc-600 shrink-0">
                            {new Date()
                              .toISOString()
                              .split("T")[1]
                              .slice(0, -1)}
                          </span>
                          <span className={`shrink-0 w-[140px] ${typeColor}`}>
                            {e.type}
                          </span>
                          <span className="text-zinc-300 break-all">
                            {summarizeEvent(e)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Configuration */}
              <div className="border border-[rgba(255,255,255,0.1)] bg-black/40 backdrop-blur-xl p-5 rounded-2xl space-y-6">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Settings
                </h3>
                <div className="space-y-2">
                  <label
                    className={`text-[10px] uppercase text-zinc-400 ${geistMono.className}`}
                  >
                    Failure Injection
                  </label>
                  <select
                    value={failAt ?? "null"}
                    onChange={(e) =>
                      setFailAt(
                        e.target.value === "null"
                          ? null
                          : (e.target.value as FailStep)
                      )
                    }
                    className={`w-full bg-[#111] border border-[rgba(255,255,255,0.15)] text-white px-3 py-2.5 text-xs rounded-lg focus:outline-none focus:border-white transition-colors ${geistMono.className}`}
                  >
                    {FAIL_OPTIONS.map((opt) => (
                      <option
                        key={String(opt.value)}
                        value={opt.value ?? "null"}
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">
                    Auto-ack Hooks
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={autoAck}
                      onChange={(e) => setAutoAck(e.target.checked)}
                    />
                    <div
                      className={`w-10 h-5 rounded-full transition-colors ${
                        autoAck ? "bg-[#white]" : "bg-zinc-800"
                      }`}
                      style={{ backgroundColor: autoAck ? '#fff' : '' }}
                    ></div>
                    <div
                      className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        autoAck ? "translate-x-5 bg-black" : "bg-zinc-400"
                      }`}
                    ></div>
                  </div>
                </label>
              </div>

              {/* Manual Controls */}
              <div className="border border-[rgba(255,255,255,0.1)] bg-black/40 backdrop-blur-xl p-5 rounded-2xl space-y-6">
                <div className="space-y-1">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                    Manual Actions
                  </h3>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Trigger suspended workflow hooks.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div
                      className={`text-[10px] uppercase text-zinc-500 ${geistMono.className}`}
                    >
                      Restaurant
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          resume("restaurant-accept", { accepted: true })
                        }
                        className={`border border-[rgba(255,255,255,0.15)] hover:bg-white hover:text-black transition-colors text-[10px] uppercase tracking-wider py-2 rounded-lg ${geistMono.className}`}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() =>
                          resume("restaurant-accept", {
                            accepted: false,
                            reason: "Out of dough",
                          })
                        }
                        className={`border border-[#ee0000]/30 text-[#ee0000] hover:bg-[#ee0000] hover:text-white transition-colors text-[10px] uppercase tracking-wider py-2 rounded-lg ${geistMono.className}`}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div
                      className={`text-[10px] uppercase text-zinc-500 ${geistMono.className}`}
                    >
                      Driver
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          resume("driver-accept", { accepted: true })
                        }
                        className={`border border-[rgba(255,255,255,0.15)] hover:bg-white hover:text-black transition-colors text-[10px] uppercase tracking-wider py-2 rounded-lg ${geistMono.className}`}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() =>
                          resume("driver-accept", { accepted: false })
                        }
                        className={`border border-[#ee0000]/30 text-[#ee0000] hover:bg-[#ee0000] hover:text-white transition-colors text-[10px] uppercase tracking-wider py-2 rounded-lg ${geistMono.className}`}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div
                      className={`text-[10px] uppercase text-zinc-500 ${geistMono.className}`}
                    >
                      Delivery
                    </div>
                    <button
                      onClick={() => resume("delivered")}
                      className={`w-full border border-[rgba(255,255,255,0.15)] hover:bg-white hover:text-black transition-colors text-[10px] uppercase tracking-wider py-2 rounded-lg ${geistMono.className}`}
                    >
                      Mark Delivered
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
