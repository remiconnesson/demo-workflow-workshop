"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Manrope, Cormorant_Garamond } from "next/font/google";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
} from "@/workflows/place-order";

const manrope = Manrope({ subsets: ["latin"], weight: ["500", "700"] });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const MENU: OrderItem[] = [
  { id: "pho", name: "Imperial Beef Phở", price: 24, qty: 0 },
  { id: "banh", name: "Truffle Bánh Mì", price: 18, qty: 0 },
  { id: "spring", name: "Wagyu Spring Rolls (4)", price: 16, qty: 0 },
  { id: "boba", name: "Gold-Flake Taro Boba", price: 12, qty: 0 },
];

const STEPS: { key: string; label: string }[] = [
  { key: "validateOrder", label: "Verifying Request" },
  { key: "chargePayment", label: "Authorizing Payment" },
  { key: "notifyRestaurant", label: "Transmitting to Kitchen" },
  { key: "assignDriver", label: "Dispatching Courier" },
  { key: "trackDelivery", label: "En Route" },
  { key: "sendReceipt", label: "Finalizing Order" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "Perfect Execution" },
  { value: "validateOrder", label: "Error: Verification" },
  { value: "chargePayment", label: "Error: Payment" },
  { value: "notifyRestaurant", label: "Error: Kitchen" },
  { value: "assignDriver", label: "Error: Dispatch" },
  { value: "sendReceipt", label: "Error: Finalization" },
];

type StepStatus =
  | "pending"
  | "running"
  | "waiting"
  | "success"
  | "failed"
  | "skipped";

export default function LuxuryFoodDelivery() {
  const [cart, setCart] = useState<OrderItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "pho" ? 1 : 0 }))
  );
  const [customerName, setCustomerName] = useState("Mr. Bruce Wayne");
  const [address, setAddress] = useState("Penthouse 4B, Gotham Tower");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepStatuses, setStepStatuses] = useState<
    Record<string, StepStatus>
  >({});
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
  const totalItems = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

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
            event.step === "notifyRestaurant"
              ? ("restaurant-accept" as const)
              : event.step === "assignDriver"
              ? ("driver-accept" as const)
              : ("delivered" as const);
          setTimeout(() => {
            void resume(
              kind,
              kind === "delivered" ? {} : { accepted: true }
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
    payload: object = {}
  ) => {
    if (!currentOrderId) return;
    await fetch(`/api/orders/${currentOrderId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
  };

  return (
    <div
      className={`${manrope.className} min-h-screen bg-[#0a0a0a] text-[#e5e4e2] selection:bg-[#d4af37] selection:text-[#0a0a0a] pb-24`}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="text-xl font-bold tracking-tighter text-white">
          RESERVE<span className="font-light text-[#e5e4e2]/60">BLACK</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#d4af37]/40 bg-[#d4af37]/10 shadow-[0_0_15px_rgba(212,175,55,0.15)]">
          <span className="text-[#d4af37] text-[10px] font-bold tracking-[0.2em] uppercase">
            Member
          </span>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="relative h-80 w-full flex items-end p-8 border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[#0a0a0a]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2a2a2a] to-[#0a0a0a]"></div>
          {/* Faux map or cinematic dark gradient */}
        </div>
        <div className="relative z-10 w-full max-w-6xl mx-auto">
          <h1
            className={`${cormorant.className} text-6xl md:text-7xl font-bold text-white tracking-wide drop-shadow-2xl`}
          >
            Phở Palace
          </h1>
          <p className="text-[#d4af37] mt-3 tracking-[0.2em] text-xs font-bold uppercase">
            Exclusive Selection • $$$$
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-12 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12">
        {/* LEFT COLUMN */}
        <section className="space-y-10">
          <div>
            <h2 className="text-[#d4af37] tracking-[0.2em] uppercase text-[10px] font-bold mb-6 flex items-center gap-4">
              <span>Curated Menu</span>
              <div className="h-px flex-1 bg-gradient-to-r from-[#d4af37]/30 to-transparent"></div>
            </h2>
            <div className="space-y-4">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#141414] p-6 rounded-none border border-transparent hover:border-[#d4af37]/50 transition-all flex justify-between items-center group relative overflow-hidden"
                >
                  {/* Subtle highlight left edge */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#d4af37]/0 via-[#d4af37]/20 to-[#d4af37]/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div>
                    <div
                      className={`${cormorant.className} text-2xl text-white font-semibold mb-1`}
                    >
                      {item.name}
                    </div>
                    <div className="text-[#d4af37] font-bold text-sm tracking-wider">
                      ${item.price.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      className="w-8 h-8 rounded-full border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center hover:bg-[#d4af37]/10 transition-colors"
                    >
                      −
                    </button>
                    <span className="w-4 text-center font-bold text-white">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      className="w-8 h-8 rounded-full border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center hover:bg-[#d4af37]/10 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-between items-center px-2">
              <span className="text-[#e5e4e2]/60 text-sm font-medium tracking-wide">
                {totalItems} {totalItems === 1 ? "Selection" : "Selections"}
              </span>
              <span
                className={`${cormorant.className} text-4xl text-white font-bold`}
              >
                ${total.toFixed(2)}
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-[#d4af37] tracking-[0.2em] uppercase text-[10px] font-bold mb-6 flex items-center gap-4">
              <span>Concierge Details</span>
              <div className="h-px flex-1 bg-gradient-to-r from-[#d4af37]/30 to-transparent"></div>
            </h2>
            <div className="bg-[#141414] p-8 border border-white/5 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 blur-3xl rounded-full"></div>

              {/* Perks */}
              <div className="border border-[#d4af37]/30 bg-[#d4af37]/5 p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37] text-lg">
                  ✦
                </div>
                <div>
                  <div className="text-[#d4af37] text-xs font-bold uppercase tracking-widest">
                    Privileges Applied
                  </div>
                  <div className="text-[#e5e4e2]/70 text-xs mt-1">
                    $0 Delivery Fee • 5% Back in Credits
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-[#e5e4e2]/50 mb-2 font-bold">
                    Recipient
                  </span>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-transparent border-b border-white/10 px-0 py-2 text-white font-medium focus:outline-none focus:border-[#d4af37] transition-colors"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-[#e5e4e2]/50 mb-2 font-bold">
                    Destination
                  </span>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-transparent border-b border-white/10 px-0 py-2 text-white font-medium focus:outline-none focus:border-[#d4af37] transition-colors"
                  />
                </label>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-[#d4af37] tracking-[0.2em] uppercase text-[10px] font-bold mb-6 flex items-center gap-4">
              <span>Simulation Settings</span>
              <div className="h-px flex-1 bg-gradient-to-r from-[#d4af37]/30 to-transparent"></div>
            </h2>
            <div className="flex flex-col gap-4">
              <label className="block">
                <span className="block text-[10px] uppercase tracking-widest text-[#e5e4e2]/50 mb-2 font-bold">
                  Saga Failure Point
                </span>
                <select
                  value={failAt ?? "null"}
                  onChange={(e) =>
                    setFailAt(
                      e.target.value === "null"
                        ? null
                        : (e.target.value as FailStep)
                    )
                  }
                  className="w-full bg-[#141414] border border-white/10 px-4 py-3 text-white text-sm focus:outline-none focus:border-[#d4af37] transition-colors appearance-none"
                >
                  {FAIL_OPTIONS.map((opt) => (
                    <option key={String(opt.value)} value={opt.value ?? "null"}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-4 p-4 border border-white/5 bg-[#141414] cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={autoAck}
                    onChange={(e) => setAutoAck(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`w-5 h-5 border flex items-center justify-center transition-colors ${
                      autoAck
                        ? "bg-[#d4af37] border-[#d4af37]"
                        : "border-white/20 group-hover:border-white/50"
                    }`}
                  >
                    {autoAck && (
                      <svg
                        className="w-3 h-3 text-black"
                        viewBox="0 0 14 14"
                        fill="none"
                      >
                        <path
                          d="M3 7.5L5.5 10L11 4"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="square"
                        />
                      </svg>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold text-white">
                    Automated Hook Resolution
                  </div>
                  <div className="text-xs text-[#e5e4e2]/50 mt-0.5">
                    Proceed without manual intervention
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={placeOrder}
              disabled={running || total === 0}
              className="flex-1 bg-[#d4af37] text-black px-8 py-5 text-sm font-bold tracking-widest uppercase hover:bg-[#ebd074] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]"
            >
              {running ? "Processing..." : "Place Order"}
            </button>
            <button
              onClick={reset}
              disabled={running}
              className="px-8 py-5 text-sm font-bold tracking-widest uppercase text-white border border-white/20 hover:bg-white/5 transition-all disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </section>

        {/* RIGHT COLUMN */}
        <section className="space-y-8">
          <div className="bg-[#1a1a1a] rounded-xl overflow-hidden border border-white/5 relative min-h-[500px] flex flex-col">
            {/* Dark cinematic dim map placeholder bg */}
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>

            <div className="relative z-10 p-8 flex-1">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-[#d4af37] tracking-[0.2em] uppercase text-[10px] font-bold">
                  Order Tracking
                </h2>
                {result && (
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 border ${
                      result === "completed"
                        ? "text-[#05a357] border-[#05a357]/30 bg-[#05a357]/10"
                        : "text-rose-500 border-rose-500/30 bg-rose-500/10"
                    }`}
                  >
                    {result === "completed" ? "Delivered" : "Aborted"}
                  </span>
                )}
              </div>

              {/* Courier Avatar placeholder if running/completed */}
              {(running || result === "completed" || Object.keys(stepStatuses).length > 0) && (
                <div className="flex items-center gap-4 mb-8 p-4 bg-[#141414] border border-white/5">
                  <div className="w-12 h-12 rounded-full border-2 border-[#d4af37] flex items-center justify-center bg-black overflow-hidden relative">
                    {/* Placeholder image */}
                    <div className="absolute inset-0 bg-white/10 opacity-80 mix-blend-luminosity flex items-center justify-center text-xs">
                      👤
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#e5e4e2]/60 uppercase tracking-widest font-bold mb-1">
                      Your Courier
                    </div>
                    <div className="text-sm text-white font-medium">
                      Alexander
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-xs text-[#e5e4e2]/60 uppercase tracking-widest font-bold mb-1">
                      Rating
                    </div>
                    <div className="text-[#d4af37] text-sm font-medium">
                      4.98 ★
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="relative ml-3 space-y-8 mt-10">
                {/* Connecting thin gold line */}
                <div className="absolute left-[5px] top-2 bottom-2 w-px bg-gradient-to-b from-[#d4af37]/60 via-[#d4af37]/20 to-transparent"></div>

                {STEPS.map((step) => {
                  const status = stepStatuses[step.key] ?? "pending";
                  return (
                    <div
                      key={step.key}
                      className="relative flex items-start gap-6"
                    >
                      <div className="relative z-10 flex-shrink-0 mt-1">
                        <StatusDot status={status} />
                      </div>
                      <div>
                        <div
                          className={`text-sm font-bold uppercase tracking-wider ${
                            status === "pending"
                              ? "text-white/30"
                              : "text-white"
                          }`}
                        >
                          {step.label}
                        </div>
                        <div className="text-[10px] font-bold text-[#d4af37] mt-1 tracking-widest uppercase">
                          {statusLabel(status)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {compensations.length > 0 && (
                <div className="mt-10 p-5 border border-rose-900/50 bg-rose-950/20">
                  <div className="text-rose-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-3">
                    Reversal Procedures
                  </div>
                  <ul className="space-y-2">
                    {compensations.map((c, i) => (
                      <li
                        key={i}
                        className="text-rose-200/70 text-xs tracking-wider"
                      >
                        • {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-[#d4af37] tracking-[0.2em] uppercase text-[10px] font-bold mb-4">
                Manual Override Controls
              </h2>
              <div className="bg-[#141414] p-5 border border-white/5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <HookBtn
                    onClick={() =>
                      resume("restaurant-accept", { accepted: true })
                    }
                  >
                    Kitchen: Accept
                  </HookBtn>
                  <HookBtn
                    variant="danger"
                    onClick={() =>
                      resume("restaurant-accept", {
                        accepted: false,
                        reason: "Capacity",
                      })
                    }
                  >
                    Kitchen: Reject
                  </HookBtn>
                  <HookBtn
                    onClick={() => resume("driver-accept", { accepted: true })}
                  >
                    Courier: Accept
                  </HookBtn>
                  <HookBtn
                    variant="danger"
                    onClick={() => resume("driver-accept", { accepted: false })}
                  >
                    Courier: Decline
                  </HookBtn>
                  <div className="sm:col-span-2">
                    <HookBtn
                      onClick={() => resume("delivered")}
                      className="w-full"
                    >
                      Confirm Delivery
                    </HookBtn>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-[#d4af37] tracking-[0.2em] uppercase text-[10px] font-bold mb-4">
                System Logs
              </h2>
              <div className="bg-black border border-white/10 p-4 h-64 overflow-auto font-mono text-[10px] text-white/60 leading-relaxed shadow-inner">
                {events.length === 0 ? (
                  <div className="text-white/30 italic">Awaiting telemetry...</div>
                ) : (
                  events.map((e, i) => (
                    <div key={i} className="mb-2">
                      <span className="text-white/40 mr-3">
                        [{new Date().toLocaleTimeString()}]
                      </span>
                      <span className={`${eventColor(e.type)} font-bold mr-2 uppercase`}>
                        {e.type}
                      </span>
                      <span className="text-white/80">{summarizeEvent(e)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function statusLabel(s: StepStatus): string {
  switch (s) {
    case "running":
      return "Processing...";
    case "waiting":
      return "Awaiting Authorization";
    case "success":
      return "Verified";
    case "failed":
      return "Error Detected";
    case "skipped":
      return "Bypassed";
    default:
      return "Standby";
  }
}

function eventColor(type: OrderEvent["type"]): string {
  if (type === "step_failed" || type === "compensating") return "text-rose-500";
  if (
    type === "step_succeeded" ||
    type === "hook_resolved" ||
    type === "compensated"
  )
    return "text-[#05a357]";
  if (type === "waiting_for_hook") return "text-[#d4af37]";
  if (type === "done") return "text-white";
  return "text-white/50";
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
  const base = "w-3 h-3 flex items-center justify-center bg-[#1a1a1a] z-10 relative";
  const innerBase = "w-2 h-2 rounded-full";
  let innerCls = "";

  switch (status) {
    case "pending":
      innerCls = "bg-white/20";
      break;
    case "running":
      innerCls = "bg-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]";
      break;
    case "waiting":
      innerCls = "bg-[#d4af37] animate-pulse shadow-[0_0_8px_rgba(212,175,55,0.8)]";
      break;
    case "success":
      innerCls = "bg-[#d4af37]";
      break;
    case "failed":
      innerCls = "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]";
      break;
    case "skipped":
      innerCls = "bg-transparent border border-white/20";
      break;
  }

  return (
    <div className={base}>
      <div className={`${innerBase} ${innerCls}`}></div>
    </div>
  );
}

function HookBtn({
  children,
  onClick,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  className?: string;
}) {
  const cls =
    variant === "danger"
      ? "text-rose-500 border border-rose-500/30 hover:bg-rose-500/10"
      : "text-white border border-white/20 hover:border-[#d4af37] hover:bg-[#d4af37]/5 hover:text-[#d4af37]";
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${cls} ${className}`}
    >
      {children}
    </button>
  );
}
