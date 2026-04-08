"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Inter } from "next/font/google";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
  CompensationAction,
} from "@/workflows/place-order";

const inter = Inter({ subsets: ["latin"] });

const MENU: OrderItem[] = [
  { id: "pho", name: "Beef Phở", price: 14, qty: 0 },
  { id: "banh", name: "Bánh Mì", price: 10, qty: 0 },
  { id: "spring", name: "Spring Rolls (4)", price: 8, qty: 0 },
  { id: "boba", name: "Taro Boba", price: 6, qty: 0 },
  { id: "pho-ga", name: "Chicken Phở", price: 13, qty: 0 },
  { id: "cafe", name: "Vietnamese Coffee", price: 5, qty: 0 },
];

const STEPS: { key: string; label: string }[] = [
  { key: "validateOrder", label: "Validate" },
  { key: "chargePayment", label: "Payment" },
  { key: "notifyRestaurant", label: "Restaurant" },
  { key: "assignDriver", label: "Driver" },
  { key: "trackDelivery", label: "Delivery" },
  { key: "sendReceipt", label: "Receipt" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "Perfect Delivery" },
  { value: "validateOrder", label: "Validation Error" },
  { value: "chargePayment", label: "Payment Failed" },
  { value: "notifyRestaurant", label: "Restaurant System Down" },
  { value: "assignDriver", label: "No Drivers Available" },
  { value: "trackDelivery", label: "Delivery Disputed" },
  { value: "sendReceipt", label: "Email System Failure" },
];

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

export default function VisionProPage() {
  const [cart, setCart] = useState<OrderItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "pho" ? 1 : 0 })),
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
  const [compensations, setCompensations] = useState<CompensationAction[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const eventFeedRef = useRef<HTMLDivElement>(null);

  const total = useMemo(
    () => cart.reduce((s, i) => s + i.price * i.qty, 0),
    [cart],
  );
  
  const totalItems = useMemo(
    () => cart.reduce((s, i) => s + i.qty, 0),
    [cart],
  );

  useEffect(() => {
    if (eventFeedRef.current) {
      eventFeedRef.current.scrollTop = eventFeedRef.current.scrollHeight;
    }
  }, [events]);

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
    setRunning(false);
  };

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
      case "waiting_for_hook":
        setStepStatuses((s) => ({ ...s, [event.step]: "waiting" }));
        break;
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
  }, []);

  useEffect(() => {
    const lastEvent = events[events.length - 1];
    if (autoAck && lastEvent?.type === "waiting_for_hook" && currentOrderId) {
      const kind =
        lastEvent.step === "notifyRestaurant"
          ? ("restaurant-accept" as const)
          : lastEvent.step === "assignDriver"
            ? ("driver-accept" as const)
            : ("delivered" as const);
      
      const timer = setTimeout(() => {
        void resume(currentOrderId, kind, kind === "delivered" ? {} : { accepted: true });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [events, autoAck, currentOrderId]);

  const placeOrder = async () => {
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
      if (!res.body) throw new Error("No response body");

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
            // Ignore framing errors
          }
        }
      }
    } catch (err) {
      console.error("Stream error:", err);
    } finally {
      setRunning(false);
    }
  };

  const resume = async (
    orderId: string,
    kind: "restaurant-accept" | "driver-accept" | "delivered",
    payload: object = {},
  ) => {
    await fetch(`/api/orders/${orderId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
  };

  return (
    <div className={`min-h-screen bg-[#0a0a0f] text-white overflow-hidden relative ${inter.className} tracking-tight`}>
      {/* Vision Pro Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 opacity-40 mix-blend-screen overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full bg-fuchsia-600 blur-[150px] animate-pulse [animation-delay:2s]" />
          <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-500 blur-[130px] animate-pulse [animation-delay:4s]" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0f]/50 to-[#0a0a0f]" />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 lg:py-16 h-screen flex flex-col">
        <header className="mb-10 flex items-end justify-between">
          <div>
            <h1 className="text-5xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-white/80 to-white/40 mb-2">
              SagaFlow <span className="text-white/20">V5</span>
            </h1>
            <p className="text-white/50 font-medium">Visionary Order Fulfillment Orchestration</p>
          </div>
          
          <div className="flex gap-4 items-center">
            {result && (
              <div className={`px-6 py-2 rounded-full border backdrop-blur-md transition-all duration-500 ${
                result === "completed" 
                  ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" 
                  : "bg-rose-500/20 border-rose-500/30 text-rose-400"
              }`}>
                {result === "completed" ? "Saga Perfected" : "Saga Reverted"}
              </div>
            )}
            <PillButton 
              onClick={placeOrder} 
              disabled={running || total === 0}
              variant="primary"
            >
              {running ? "Processing..." : "Dispatch Order"}
            </PillButton>
            <PillButton onClick={reset} disabled={running}>Reset</PillButton>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
          {/* Menu & Details */}
          <div className="lg:col-span-4 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
            <GlassCard title="Atmospheric Menu">
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.id} className="group flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all duration-300 border border-transparent hover:border-white/10">
                    <div className="flex flex-col">
                      <span className="font-semibold text-white/90">{item.name}</span>
                      <span className="text-xs text-white/40">${item.price}</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 rounded-full p-1 border border-white/5">
                      <QtyBtn onClick={() => updateQty(item.id, -1)}>−</QtyBtn>
                      <span className="w-4 text-center font-mono text-xs">{item.qty}</span>
                      <QtyBtn onClick={() => updateQty(item.id, 1)}>+</QtyBtn>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center px-2">
                <span className="text-white/40 text-sm">{totalItems} selected</span>
                <span className="text-xl font-bold tracking-tighter text-white">${total.toFixed(2)}</span>
              </div>
            </GlassCard>

            <GlassCard title="Delivery Coordinates">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1.5 block ml-1">Recipient</label>
                  <input 
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all placeholder:text-white/20"
                    placeholder="Enter name"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1.5 block ml-1">Destination</label>
                  <input 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all placeholder:text-white/20"
                    placeholder="Enter address"
                  />
                </div>
              </div>
            </GlassCard>

            <GlassCard title="Orchestration Config">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-1.5 block ml-1">Saga Scenario</label>
                  <select 
                    value={failAt ?? "null"}
                    onChange={(e) => setFailAt(e.target.value === "null" ? null : e.target.value as FailStep)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all appearance-none cursor-pointer"
                  >
                    {FAIL_OPTIONS.map(opt => (
                      <option key={String(opt.value)} value={opt.value ?? "null"} className="bg-[#1a1a24]">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div 
                  className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-all"
                  onClick={() => setAutoAck(!autoAck)}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold">Autonomous Hooks</span>
                    <span className="text-[10px] text-white/40">Auto-resume on triggers</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${autoAck ? 'bg-indigo-500' : 'bg-white/10'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${autoAck ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Saga Execution & Live Feed */}
          <div className="lg:col-span-8 flex flex-col gap-8 min-h-0">
            {/* Step Row */}
            <div className="grid grid-cols-6 gap-3">
              {STEPS.map((step, idx) => {
                const status = stepStatuses[step.key] ?? "pending";
                return (
                  <SagaChip key={step.key} label={step.label} status={status} index={idx + 1} />
                );
              })}
            </div>

            {/* Hook Controls & Compensations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlassCard title="Manual Overrides">
                <div className="grid grid-cols-2 gap-3">
                  <HookBtn onClick={() => resume(currentOrderId!, "restaurant-accept", { accepted: true })} disabled={!currentOrderId}>Resto: Yes</HookBtn>
                  <HookBtn onClick={() => resume(currentOrderId!, "restaurant-accept", { accepted: false, reason: "Busy" })} variant="danger" disabled={!currentOrderId}>Resto: No</HookBtn>
                  <HookBtn onClick={() => resume(currentOrderId!, "driver-accept", { accepted: true })} disabled={!currentOrderId}>Driver: Yes</HookBtn>
                  <HookBtn onClick={() => resume(currentOrderId!, "driver-accept", { accepted: false })} variant="danger" disabled={!currentOrderId}>Driver: No</HookBtn>
                  <HookBtn onClick={() => resume(currentOrderId!, "delivered")} className="col-span-2" disabled={!currentOrderId}>Confirm Delivery</HookBtn>
                </div>
              </GlassCard>

              <GlassCard title="Compensation Logic">
                {compensations.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-4 border-2 border-dashed border-white/5 rounded-2xl min-h-[140px]">
                    <span className="text-white/10 text-[10px] font-mono uppercase tracking-widest">Awaiting Failure</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar">
                    {compensations.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest italic">Rolled Back:</span>
                        <span className="text-xs font-medium">{c}</span>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>

            {/* Real-time Event Feed */}
            <div className="flex-1 min-h-0">
              <GlassCard title="Orchestrator Terminal" className="h-full flex flex-col" innerClassName="flex-1 flex flex-col min-h-0">
                <div 
                  ref={eventFeedRef}
                  className="flex-1 overflow-y-auto space-y-2 bg-black/40 rounded-2xl p-4 font-mono text-[10px] custom-scrollbar border border-white/5 inner-shadow"
                >
                  {events.length === 0 ? (
                    <div className="text-white/20 h-full flex items-center justify-center italic">Initialize dispatch to stream telemetry...</div>
                  ) : (
                    events.map((e, i) => (
                      <div key={i} className="flex gap-4 group">
                        <span className="text-white/20 tabular-nums shrink-0">{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span className={`uppercase font-bold tracking-widest shrink-0 ${getEventColor(e.type)}`}>{e.type.replace(/_/g, ' ')}</span>
                        <span className="text-white/60 flex-1">{formatEventDetail(e)}</span>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .inner-shadow {
          box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  );
}

function GlassCard({ title, children, className = "", innerClassName = "" }: { title: string; children: React.ReactNode; className?: string; innerClassName?: string }) {
  return (
    <div className={`bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] ${className}`}>
      <h2 className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-5 pl-2 font-bold">{title}</h2>
      <div className={innerClassName}>
        {children}
      </div>
    </div>
  );
}

function PillButton({ children, onClick, disabled, variant = "secondary" }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; variant?: "primary" | "secondary" }) {
  const base = "rounded-full px-8 py-3.5 text-sm font-bold transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed transform active:scale-95";
  const variants = {
    primary: "bg-white text-black hover:bg-white/90 shadow-[0_10px_20px_rgba(255,255,255,0.1)]",
    secondary: "bg-white/10 text-white hover:bg-white/20 border border-white/10",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  );
}

function QtyBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-white/60 hover:text-white"
    >
      {children}
    </button>
  );
}

function SagaChip({ label, status, index }: { label: string; status: StepStatus; index: number }) {
  const configs = {
    pending: "bg-white/5 border-white/5 text-white/30",
    running: "bg-indigo-500/20 border-indigo-500/40 text-indigo-400 animate-pulse scale-105",
    waiting: "bg-amber-500/20 border-amber-500/40 text-amber-400 animate-pulse",
    success: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
    failed: "bg-rose-500/20 border-rose-500/40 text-rose-400",
    skipped: "bg-white/5 border-white/5 text-white/10",
  };

  return (
    <div className={`relative flex flex-col items-center justify-center p-4 rounded-3xl border backdrop-blur-md transition-all duration-500 ${configs[status]}`}>
      <span className="text-[10px] font-mono mb-1 opacity-50">{index.toString().padStart(2, '0')}</span>
      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-tighter text-center">{label}</span>
      {status === 'running' && (
        <div className="absolute -bottom-1 left-1/4 right-1/4 h-[2px] bg-indigo-400 shadow-[0_0_10px_#818cf8]" />
      )}
    </div>
  );
}

function HookBtn({ children, onClick, variant = "default", disabled, className = "" }: { children: React.ReactNode; onClick: () => void; variant?: "default" | "danger"; disabled?: boolean; className?: string }) {
  const colors = variant === 'danger' 
    ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20" 
    : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white";
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`py-3 px-4 rounded-2xl border text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-10 ${colors} ${className}`}
    >
      {children}
    </button>
  );
}

function getEventColor(type: OrderEvent["type"]) {
  if (type.includes("failed") || type.includes("compensat")) return "text-rose-400";
  if (type.includes("succeeded") || type.includes("resolved")) return "text-emerald-400";
  if (type === "waiting_for_hook") return "text-amber-400";
  if (type === "done") return "text-sky-400";
  return "text-indigo-400";
}

function formatEventDetail(e: OrderEvent) {
  switch (e.type) {
    case "step_running":
    case "step_succeeded":
    case "step_failed":
    case "step_skipped":
      return `${e.label}${"detail" in e && e.detail ? ` → ${e.detail}` : ""}${"error" in e && e.error ? ` ✖ ${e.error}` : ""}`;
    case "waiting_for_hook": return `Awaiting external trigger: ${e.label}`;
    case "hook_resolved": return `Resumed: ${e.detail ?? "OK"}`;
    case "compensation_pushed": return `Inverse action registered: ${e.action}`;
    case "compensating": return `Executing rollback: ${e.action}`;
    case "compensated": return `Rollback completed: ${e.action}`;
    case "log": return e.message;
    case "done": return `Final State: ${e.status.toUpperCase()}`;
    default: return "";
  }
}
