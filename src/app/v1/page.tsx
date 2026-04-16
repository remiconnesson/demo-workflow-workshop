"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { VT323 } from "next/font/google";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
} from "@/workflows/place-order";

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const MENU: OrderItem[] = [
  { id: "pizza", name: "NEON PIZZA", price: 15, qty: 0 },
  { id: "burger", name: "CYBER BURGER", price: 12, qty: 0 },
  { id: "fries", name: "RETRO FRIES", price: 5, qty: 0 },
  { id: "soda", name: "8-BIT SODA", price: 3, qty: 0 },
];

const STEPS: { key: string; label: string }[] = [
  { key: "validateOrder", label: "VALIDATE ORDER" },
  { key: "chargeCard", label: "CHARGE PAYMENT" },
  { key: "pingRestaurant", label: "NOTIFY KITCHEN" },
  { key: "findDriver", label: "ASSIGN RUNNER" },
  { key: "trackDelivery", label: "TRACK DELIVERY" },
  { key: "sendReceipts", label: "SEND RECEIPT" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "HAPPY PATH" },
  { value: "validateOrder", label: "FAIL @ VALIDATE" },
  { value: "chargeCard", label: "FAIL @ PAYMENT" },
  { value: "pingRestaurant", label: "FAIL @ KITCHEN" },
  { value: "findDriver", label: "FAIL @ RUNNER" },
  { value: "sendReceipts", label: "FAIL @ RECEIPT" },
];

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

export default function ArcadeOrderPage() {
  const [cart, setCart] = useState<OrderItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "pizza" ? 1 : 0 })),
  );
  const [customerName, setCustomerName] = useState("PLAYER ONE");
  const [address, setAddress] = useState("SECTOR 7-G");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [result, setResult] = useState<"completed" | "rolled_back" | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const totalItems = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const updateQty = (id: string, delta: number) =>
    setCart((c) =>
      c.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)),
    );

  const reset = () => {
    abortRef.current?.abort();
    setEvents([]);
    setStepStatuses({});
    setResult(null);
    setCompensations([]);
    setCurrentOrderId(null);
  };

  const resume = useCallback(async (
    kind: "restaurant-accept" | "driver-accept" | "delivered",
    payload: object = {},
  ) => {
    if (!currentOrderId) return;
    await fetch(`/api/orders/${currentOrderId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
  }, [currentOrderId]);

  const applyEvent = useCallback((event: OrderEvent) => {
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
            void resume(kind, kind === "delivered" ? {} : { accepted: true });
          }, 1200);
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
  }, [autoAck, resume]);

  const placeOrder = useCallback(async () => {
    reset();
    setRunning(true);

    const orderId = `SAGA_${Date.now().toString(36).toUpperCase()}`;
    setCurrentOrderId(orderId);

    const input: OrderInput = {
      orderId,
      customerName,
      address,
      items: cart.filter((i) => i.qty > 0),
      failAt,
      autoAck,
    };

    try {
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
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  }, [cart, customerName, address, failAt, autoAck, applyEvent]);

  return (
    <main className={`min-h-screen bg-[#0d0221] text-[#00f3ff] p-4 md:p-8 relative overflow-hidden ${vt323.className} selection:bg-[#ff00ff] selection:text-white`}>
      {/* CRT SCANLINES OVERLAY */}
      <div className="pointer-events-none fixed inset-0 z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      
      {/* RETRO GRID BACKGROUND */}
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-[linear-gradient(transparent_0%,rgba(188,19,254,0.2)_100%)] [perspective:500px] overflow-hidden -z-10">
        <div className="absolute inset-0 [transform:rotateX(60deg)] [background-image:linear-gradient(to_right,rgba(0,243,255,0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,243,255,0.2)_1px,transparent_1px)] [background-size:40px_40px] [background-position:center_top]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* HEADER */}
        <header className="text-center mb-8">
          <h1 className="text-6xl md:text-8xl font-bold italic tracking-tighter text-[#ff00ff] [text-shadow:3px_3px_0_#bc13fe,6px_6px_0_#0d0221,0_0_20px_#ff00ff]">
            SAGA DELIVERY
          </h1>
          <p className="text-2xl tracking-[0.2em] animate-pulse mt-2">INSERT COIN TO START YOUR ORDER</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT PANEL: CONFIGURATION */}
          <div className="lg:col-span-5 space-y-6">
            <ArcadePanel title="SELECT ITEMS">
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b border-[#00f3ff]/30 pb-2">
                    <div>
                      <div className="text-2xl">{item.name}</div>
                      <div className="text-lg text-[#bc13fe]">${item.price}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <ArcadeMiniBtn onClick={() => updateQty(item.id, -1)}>-</ArcadeMiniBtn>
                      <span className="text-3xl min-w-[1.5rem] text-center">{item.qty}</span>
                      <ArcadeMiniBtn onClick={() => updateQty(item.id, 1)}>+</ArcadeMiniBtn>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between text-3xl pt-2 text-[#ff00ff]">
                  <span>TOTAL CREDITS:</span>
                  <span>{total}</span>
                </div>
              </div>
            </ArcadePanel>

            <ArcadePanel title="PLAYER DATA">
              <div className="space-y-4">
                <div>
                  <label className="block text-xl mb-1">ID TAG:</label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                    className="w-full bg-[#0d0221] border-2 border-[#00f3ff] p-2 text-2xl focus:outline-none focus:border-[#ff00ff] focus:shadow-[0_0_15px_#ff00ff]"
                  />
                </div>
                <div>
                  <label className="block text-xl mb-1">DROP ZONE:</label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value.toUpperCase())}
                    className="w-full bg-[#0d0221] border-2 border-[#00f3ff] p-2 text-2xl focus:outline-none focus:border-[#ff00ff] focus:shadow-[0_0_15px_#ff00ff]"
                  />
                </div>
              </div>
            </ArcadePanel>

            <ArcadePanel title="DIFFICULTY SETTINGS">
              <div className="space-y-4">
                <div>
                  <label className="block text-xl mb-1">FAILURE SCENARIO:</label>
                  <select
                    value={failAt ?? "null"}
                    onChange={(e) => setFailAt(e.target.value === "null" ? null : (e.target.value as FailStep))}
                    className="w-full bg-[#0d0221] border-2 border-[#00f3ff] p-2 text-2xl focus:outline-none focus:border-[#ff00ff] appearance-none cursor-pointer"
                  >
                    {FAIL_OPTIONS.map((opt) => (
                      <option key={String(opt.value)} value={opt.value ?? "null"} className="bg-[#0d0221]">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setAutoAck(!autoAck)}>
                  <div className={`w-8 h-8 border-2 border-[#00f3ff] flex items-center justify-center ${autoAck ? 'bg-[#00f3ff]' : ''}`}>
                    {autoAck && <span className="text-[#0d0221] text-2xl font-bold">X</span>}
                  </div>
                  <span className="text-xl">AUTO-PILOT MODE (AUTO-ACK)</span>
                </div>
              </div>
            </ArcadePanel>

            <div className="flex gap-4">
              <button
                onClick={placeOrder}
                disabled={running || total === 0}
                className={`flex-1 py-4 text-4xl font-bold border-4 border-[#00f3ff] bg-transparent transition-all relative overflow-hidden group
                  ${running || total === 0 ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:bg-[#00f3ff] hover:text-[#0d0221] hover:shadow-[0_0_30px_#00f3ff] active:translate-y-1'}`}
              >
                <span className="relative z-10">{running ? "SAGA RUNNING..." : "INSERT COIN"}</span>
                {!running && total > 0 && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />}
              </button>
              <button
                onClick={reset}
                disabled={running}
                className="px-6 py-4 text-3xl border-4 border-[#ff2a6d] text-[#ff2a6d] hover:bg-[#ff2a6d] hover:text-white transition-all disabled:opacity-30"
              >
                RESET
              </button>
            </div>
          </div>

          {/* RIGHT PANEL: SAGA FEED & STATUS */}
          <div className="lg:col-span-7 space-y-6">
            <ArcadePanel title="SAGA STATUS">
              <div className="space-y-4">
                {result && (
                  <div className={`text-center py-2 text-4xl border-4 mb-4 ${result === 'completed' ? 'border-[#00f3ff] text-[#00f3ff] [text-shadow:0_0_10px_#00f3ff]' : 'border-[#ff2a6d] text-[#ff2a6d] [text-shadow:0_0_10px_#ff2a6d]'}`}>
                    {result === 'completed' ? 'MISSION SUCCESS' : 'SYSTEM OVERRIDE: ROLLED BACK'}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {STEPS.map((step, idx) => {
                    const status = stepStatuses[step.key] ?? "pending";
                    return (
                      <div key={step.key} className={`p-3 border-2 transition-all flex flex-col ${status === 'pending' ? 'border-[#00f3ff]/20 text-[#00f3ff]/40' : status === 'running' ? 'border-[#ff00ff] text-[#ff00ff] shadow-[0_0_10px_#ff00ff] animate-pulse' : status === 'waiting' ? 'border-[#bc13fe] text-[#bc13fe] shadow-[0_0_10px_#bc13fe]' : status === 'success' ? 'border-[#00f3ff] text-[#00f3ff]' : status === 'failed' ? 'border-[#ff2a6d] text-[#ff2a6d]' : 'border-gray-600 text-gray-600'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xl">{idx + 1}. {step.label}</span>
                          <StatusIcon status={status} />
                        </div>
                        <div className="h-2 bg-[#0d0221] border border-current overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${status === 'pending' ? 'w-0' : status === 'running' ? 'w-1/2 bg-[#ff00ff]' : 'w-full bg-current'}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {compensations.length > 0 && (
                  <div className="mt-4 p-4 border-2 border-[#ff2a6d] bg-[#ff2a6d]/10">
                    <div className="text-2xl text-[#ff2a6d] font-bold mb-2">CRITICAL RECOVERY (COMPENSATIONS):</div>
                    <ul className="grid grid-cols-2 gap-2">
                      {compensations.map((c, i) => (
                        <li key={i} className="text-xl text-[#ff2a6d] flex items-center gap-2">
                          <span className="animate-pulse">▶</span> {c.toUpperCase()}
                        </li >
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ArcadePanel>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ArcadePanel title="MANUAL INPUT">
                <div className="grid grid-cols-1 gap-2">
                  <ArcadeActionBtn onClick={() => resume("restaurant-accept", { accepted: true })}>KITCHEN ACK</ArcadeActionBtn>
                  <ArcadeActionBtn variant="danger" onClick={() => resume("restaurant-accept", { accepted: false, reason: "OUT OF STOCK" })}>KITCHEN REJECT</ArcadeActionBtn>
                  <ArcadeActionBtn onClick={() => resume("driver-accept", { accepted: true })}>RUNNER ACK</ArcadeActionBtn>
                  <ArcadeActionBtn variant="danger" onClick={() => resume("driver-accept", { accepted: false })}>RUNNER DECLINE</ArcadeActionBtn>
                  <ArcadeActionBtn onClick={() => resume("delivered")}>FINAL DELIVERY</ArcadeActionBtn>
                </div>
              </ArcadePanel>

              <ArcadePanel title="EVENT LOG">
                <div 
                  ref={scrollRef}
                  className="h-[280px] overflow-auto bg-[#0d0221] border-2 border-[#00f3ff]/50 p-2 font-mono text-lg scrollbar-thin scrollbar-thumb-[#00f3ff] scrollbar-track-transparent"
                >
                  {events.length === 0 ? (
                    <div className="text-[#00f3ff]/30">SYSTEM READY... AWAITING SAGA...</div>
                  ) : (
                    events.map((e, i) => (
                      <div key={i} className="mb-2 leading-tight">
                        <span className="text-[#bc13fe] mr-2">[{new Date().toLocaleTimeString('en-US', { hour12: false })}]</span>
                        <span className={eventStyle(e.type)}>{e.type.toUpperCase()}</span>
                        <div className="pl-4 text-white/80">{summarizeEvent(e)}</div>
                      </div>
                    ))
                  )}
                </div>
              </ArcadePanel>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #0d0221;
        }
        ::-webkit-scrollbar-thumb {
          background: #00f3ff;
          border-radius: 0;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #ff00ff;
        }
      `}</style>
    </main>
  );
}

function ArcadePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-4 border-[#00f3ff] bg-[#0d0221]/80 p-4 relative shadow-[0_0_20px_rgba(0,243,255,0.2)]">
      <div className="absolute -top-4 left-4 bg-[#0d0221] px-2 text-2xl font-bold text-[#ff00ff] [text-shadow:0_0_10px_#ff00ff]">
        {title}
      </div>
      {children}
    </div>
  );
}

function ArcadeMiniBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 border-2 border-[#00f3ff] flex items-center justify-center text-3xl hover:bg-[#00f3ff] hover:text-[#0d0221] active:translate-y-1 transition-all"
    >
      {children}
    </button>
  );
}

function ArcadeActionBtn({ children, onClick, variant = "default" }: { children: React.ReactNode; onClick: () => void; variant?: "default" | "danger" }) {
  const color = variant === "danger" ? "#ff2a6d" : "#00f3ff";
  return (
    <button
      onClick={onClick}
      style={{ borderColor: color, color: color }}
      className={`border-2 py-2 text-xl font-bold transition-all hover:bg-[${color}] hover:text-[#0d0221] active:translate-y-0.5`}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = color;
        e.currentTarget.style.color = "#0d0221";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.color = color;
      }}
    >
      {children}
    </button>
  );
}

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "success": return <span className="text-xl">✓</span>;
    case "failed": return <span className="text-xl">⚠</span>;
    case "running": return <span className="text-xl animate-spin">◒</span>;
    case "waiting": return <span className="text-xl animate-pulse">?</span>;
    case "skipped": return <span className="text-xl opacity-50">»</span>;
    default: return <span className="text-xl opacity-20">○</span>;
  }
}

function eventStyle(type: OrderEvent["type"]): string {
  if (type === "step_failed" || type === "compensating") return "text-[#ff2a6d] font-bold";
  if (type === "step_succeeded" || type === "hook_resolved" || type === "compensated") return "text-[#00f3ff] font-bold";
  if (type === "waiting_for_hook") return "text-[#bc13fe] font-bold";
  if (type === "done") return "text-[#ff00ff] font-bold underline";
  return "text-[#00f3ff]/60";
}

function summarizeEvent(e: OrderEvent): string {
  switch (e.type) {
    case "step_running":
    case "step_succeeded":
    case "step_failed":
    case "step_skipped":
      return `${e.label}${"detail" in e && e.detail ? ` > ${e.detail}` : ""}${"error" in e && e.error ? ` ERR: ${e.error}` : ""}`;
    case "waiting_for_hook":
      return `PAUSED: AWAITING ${e.label.toUpperCase()}`;
    case "hook_resolved":
      return `RECEIVED: ${e.detail?.toUpperCase() ?? e.token}`;
    case "compensation_pushed":
      return `RECOVERY ADDED: ${e.action.toUpperCase()} (FOR ${e.forStep.toUpperCase()})`;
    case "compensating":
    case "compensated":
      return `EXECUTING RECOVERY: ${e.action.toUpperCase()}`;
    case "log":
      return `SYS_LOG: ${e.message.toUpperCase()}`;
    case "done":
      return `PROCESS TERMINATED: ${e.status.toUpperCase()}`;
    default:
      return "";
  }
}
