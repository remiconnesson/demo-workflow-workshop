"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Orbitron, Share_Tech_Mono } from "next/font/google";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
} from "@/workflows/place-order";

const orbitron = Orbitron({ subsets: ["latin"] });
const shareTech = Share_Tech_Mono({ weight: "400", subsets: ["latin"] });

const MENU: OrderItem[] = [
  { id: "ghostproc", name: "GhostProc Triangle", price: 12, qty: 0 },
  { id: "zeroday", name: "ZeroDay Glaze", price: 15, qty: 0 },
  { id: "nullbyte", name: "NullByte Core", price: 10, qty: 0 },
  { id: "edge", name: "Edge Runtime Jalapeño", price: 14, qty: 0 },
  { id: "hydrate", name: "Hydration Hole", price: 8, qty: 0 },
];

const STEPS: { key: string; label: string }[] = [
  { key: "validateOrder", label: "01 // DOUGH CHECK" },
  { key: "chargePayment", label: "02 // PAYMENT_SYS" },
  { key: "notifyRestaurant", label: "03 // BAKING_INIT" },
  { key: "assignDriver", label: "04 // COURIER_REQ" },
  { key: "trackDelivery", label: "05 // EN_ROUTE" },
  { key: "sendReceipt", label: "06 // DELIVERED" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "NULL (Happy path)" },
  { value: "validateOrder", label: "ERR_AT_VALIDATE" },
  { value: "chargePayment", label: "ERR_AT_PAYMENT" },
  { value: "notifyRestaurant", label: "ERR_AT_BAKING" },
  { value: "assignDriver", label: "ERR_AT_COURIER" },
  { value: "sendReceipt", label: "ERR_AT_DELIVER" },
];

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

export default function V19Page() {
  const [cart, setCart] = useState<OrderItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "ghostproc" ? 1 : 0 })),
  );
  const [customerName, setCustomerName] = useState("Neo Anderson");
  const [address, setAddress] = useState("Sector 4, Neon Grid");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [result, setResult] = useState<"completed" | "rolled_back" | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);

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

  const dronePos = useMemo(() => {
    if (stepStatuses["sendReceipt"] === "success" || stepStatuses["sendReceipt"] === "running" || stepStatuses["trackDelivery"] === "success") return { x: 280, y: 20, rot: 75 };
    if (stepStatuses["trackDelivery"] === "running" || stepStatuses["trackDelivery"] === "waiting") return { x: 150, y: 40, rot: 75 };
    if (stepStatuses["assignDriver"] === "success") return { x: 20, y: 70, rot: 75 };
    return { x: 20, y: 70, rot: 75 };
  }, [stepStatuses]);

  return (
    <div className={`${shareTech.className} min-h-screen bg-[#050510] text-[#00ff88] p-4 md:p-8 relative overflow-x-hidden`}>
      {/* Background Volumetric Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,0,153,0.15),transparent_50%),radial-gradient(circle_at_50%_100%,rgba(0,255,136,0.1),transparent_50%)]" />
      
      {/* CRT Scanline Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,0),rgba(255,255,255,0)_50%,rgba(0,0,0,1)_50%,rgba(0,0,0,1))] bg-[size:100%_4px]" />
      
      <div className="relative z-10 max-w-7xl mx-auto">
        <h1 className={`${orbitron.className} text-3xl md:text-5xl font-bold text-center mb-10 tracking-widest text-[#ff0099] drop-shadow-[0_0_10px_rgba(255,0,153,0.8)]`} style={{ textShadow: "3px 0px 0px rgba(0, 255, 136, 0.7), -3px 0px 0px rgba(255, 0, 153, 0.7)" }}>
          TRIANGLE DONUTS <span className="text-[#00ff88] text-2xl md:text-4xl">:: NEON_DRONE</span>
        </h1>

        <div className="grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-10 items-start">
          
          {/* LEFT: Phone Mockup */}
          <div className="flex-shrink-0 relative w-full max-w-[360px] h-[780px] rounded-[30px] border-[2px] border-[#00ff88]/30 bg-[#050510] shadow-[0_0_50px_rgba(0,255,136,0.15)] overflow-hidden flex flex-col mx-auto xl:mx-0">
            {/* The Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[50px] border-r-[50px] border-t-[40px] border-l-transparent border-r-transparent border-t-[#00ff88]/30 z-20 shadow-[0_5px_15px_rgba(0,255,136,0.3)]">
              <div className="absolute -top-[42px] -left-[46px] w-0 h-0 border-l-[46px] border-r-[46px] border-t-[36px] border-l-transparent border-r-transparent border-t-[#050510]" />
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-10 z-0 relative scrollbar-hide flex flex-col">
              <div className="text-center mb-6">
                <h2 className={`${orbitron.className} text-xl text-[#ff0099] drop-shadow-[0_0_8px_rgba(255,0,153,0.8)]`}>SYS_MENU</h2>
              </div>

              {/* Menu / Cart */}
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center border-b border-[#00ff88]/20 pb-3">
                    <div>
                      <div className={`text-[#00ff88] font-bold ${orbitron.className} text-sm leading-tight`} style={{ textShadow: "1px 0px 1px rgba(0, 255, 136, 0.5), -1px 0px 1px rgba(255, 0, 153, 0.5)" }}>{item.name}</div>
                      <div className="text-[#00ff88]/60 text-xs mt-1">USD ${item.price.toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 flex items-center justify-center border border-[#ff0099]/50 text-[#ff0099] hover:bg-[#ff0099]/20 transition-colors bg-black/50 text-xs">[-]</button>
                      <span className="w-5 text-center text-sm">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 flex items-center justify-center border border-[#00ff88]/50 text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors bg-black/50 text-xs">[+]</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Customer Details */}
              <div className="space-y-3 mt-6 border-t border-[#00ff88]/20 pt-6">
                <label className="block">
                  <span className="block text-[10px] text-[#00ff88]/70 mb-1 uppercase tracking-wider">ID_HANDLE</span>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-[#050510] border border-[#00ff88]/30 px-3 py-2 text-sm text-[#00ff88] focus:border-[#00ff88] outline-none transition-colors"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] text-[#00ff88]/70 mb-1 uppercase tracking-wider">DROP_COORDINATES</span>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-[#050510] border border-[#00ff88]/30 px-3 py-2 text-sm text-[#00ff88] focus:border-[#00ff88] outline-none transition-colors"
                  />
                </label>
              </div>

              {/* Tracking Map (conditionally rendered) */}
              {(running || result) && (
                <div className="mt-6 border border-[#00ff88]/30 p-3 bg-black/60 relative shadow-[0_0_15px_rgba(0,255,136,0.1)]">
                  <h3 className={`${orbitron.className} text-xs text-[#00ff88] text-center`}>LINK_ESTABLISHED</h3>
                  <div className="w-full h-24 relative mt-3 bg-[#050510] overflow-hidden border border-[#00ff88]/20">
                    <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(0,255,136,1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,136,1)_1px,transparent_1px)] bg-[size:15px_15px]" />
                    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                      <polyline points="20,70 150,40 280,20" fill="none" stroke="#ff0099" strokeWidth="2" strokeDasharray="4 4" className="opacity-50" />
                    </svg>
                    {/* Drone marker */}
                    <div 
                      className="absolute transition-all duration-1000 z-10 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[12px] border-l-transparent border-r-transparent border-b-[#00ff88] origin-bottom"
                      style={{ 
                        left: dronePos.x - 6,
                        top: dronePos.y - 12, 
                        transform: `rotate(${dronePos.rot}deg)`,
                        filter: 'drop-shadow(0 0 5px #00ff88)' 
                      }} 
                    />
                    {/* Target pin */}
                    <div className="absolute w-3 h-3 bg-[#ff0099] rotate-45" style={{ left: 280 - 6, top: 20 - 6, filter: 'drop-shadow(0 0 5px #ff0099)' }} />
                  </div>
                </div>
              )}

              {/* Call to action */}
              <div className="mt-auto pt-8">
                <button 
                  onClick={placeOrder}
                  disabled={running || total === 0}
                  className="w-full bg-[#00ff88]/10 border border-[#00ff88] text-[#00ff88] py-3 uppercase font-bold hover:bg-[#00ff88]/30 transition-colors disabled:opacity-30 flex items-center justify-center gap-2 tracking-widest"
                  style={{ textShadow: "0 0 5px #00ff88" }}
                >
                  {running ? "EXEC_SAGA..." : "INIT_ORDER"}
                </button>
                <button 
                  onClick={reset}
                  disabled={running}
                  className="w-full mt-3 bg-transparent border border-[#ff0099]/40 text-[#ff0099] py-2 uppercase text-xs hover:bg-[#ff0099]/20 transition-colors disabled:opacity-30 tracking-widest"
                >
                  SYS_RESET
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Dashboard Panels */}
          <div className="flex flex-col gap-6 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* CONFIG */}
              <Card title="SYS_CONFIG">
                <label className="block text-xs text-[#00ff88]/70 mb-1 uppercase tracking-wider">FAIL_SCENARIO</label>
                <select
                  value={failAt ?? "null"}
                  onChange={(e) => setFailAt(e.target.value === "null" ? null : (e.target.value as FailStep))}
                  className="w-full bg-[#050510] border border-[#ff0099]/50 text-[#ff0099] p-2 outline-none focus:border-[#ff0099] text-sm tracking-wider"
                >
                  {FAIL_OPTIONS.map((opt) => (
                    <option key={String(opt.value)} value={opt.value ?? "null"}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <label className="mt-5 flex items-center gap-3 text-sm text-[#00ff88] cursor-pointer uppercase tracking-wider">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={autoAck}
                      onChange={(e) => setAutoAck(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-[#050510] border border-[#00ff88]/50 peer-checked:bg-[#00ff88]/20 peer-checked:border-[#00ff88] transition-all"></div>
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-[#00ff88]/50 peer-checked:bg-[#00ff88] peer-checked:translate-x-5 transition-all"></div>
                  </div>
                  AUTO_ACK_HOOKS
                </label>
              </Card>

              {/* SAGA VIZ */}
              <Card title="SAGA_STATE" 
                right={
                  result && (
                    <span className={`text-[10px] px-2 py-1 border font-bold ${result === "completed" ? "text-[#00ff88] border-[#00ff88]" : "text-[#ff0099] border-[#ff0099]"} bg-black/50 tracking-wider`}>
                      {result === "completed" ? "OP_SUCCESS" : "OP_ROLLBACK"}
                    </span>
                  )
                }
              >
                <div className="flex flex-col space-y-3 relative ml-2">
                  <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-[#00ff88]/20 z-0"></div>
                  {STEPS.map((step) => {
                    const status = stepStatuses[step.key] ?? "pending";
                    return (
                      <div key={step.key} className="flex items-center gap-4 z-10">
                        <StatusTriangle status={status} />
                        <div className="flex flex-col leading-none">
                          <span className={`text-sm tracking-wide ${status === "pending" ? "text-white/30" : status === "failed" ? "text-[#ff0099]" : "text-[#00ff88]"}`}>
                            {step.label}
                          </span>
                          <span className="text-[10px] text-white/50 uppercase mt-1">{statusLabel(status)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Compensations Rollback Alert */}
                {compensations.length > 0 && (
                  <div className="mt-4 border border-[#ff0099] bg-[#ff0099]/10 p-3 relative overflow-hidden">
                    <div className="text-[#ff0099] font-bold animate-pulse mb-2 text-xs tracking-wider" style={{ textShadow: "1px 0px 0px #0ff, -1px 0px 0px #0ff" }}>
                      [!] ROLLBACK_INITIATED
                    </div>
                    <ul className="list-none text-xs text-[#ff0099] space-y-1 relative z-10">
                      {compensations.map((c, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-[#ff0099] rotate-45 inline-block"></span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* MANUAL CONTROLS */}
              <Card title="MANUAL_OVR">
                <p className="mb-4 text-[10px] text-white/50 tracking-wider">OVR INSTRUCTIONS: ONLY AVAIL W/O AUTO-ACK</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => resume("restaurant-accept", { accepted: true })} className="border border-[#00ff88]/50 text-[#00ff88] hover:bg-[#00ff88]/20 px-2 py-2 text-[10px] tracking-wider transition-colors">
                    ACK_BAKE
                  </button>
                  <button onClick={() => resume("restaurant-accept", { accepted: false, reason: "OUT_OF_STOCK" })} className="border border-[#ff0099]/50 text-[#ff0099] hover:bg-[#ff0099]/20 px-2 py-2 text-[10px] tracking-wider transition-colors">
                    REJ_BAKE
                  </button>
                  <button onClick={() => resume("driver-accept", { accepted: true })} className="border border-[#00ff88]/50 text-[#00ff88] hover:bg-[#00ff88]/20 px-2 py-2 text-[10px] tracking-wider transition-colors">
                    ACK_COURIER
                  </button>
                  <button onClick={() => resume("driver-accept", { accepted: false })} className="border border-[#ff0099]/50 text-[#ff0099] hover:bg-[#ff0099]/20 px-2 py-2 text-[10px] tracking-wider transition-colors">
                    REJ_COURIER
                  </button>
                  <button onClick={() => resume("delivered")} className="col-span-2 border border-[#0ff]/50 text-[#0ff] hover:bg-[#0ff]/20 px-2 py-2 text-[10px] tracking-wider transition-colors">
                    ACK_DELIVERED
                  </button>
                </div>
              </Card>

              {/* RAW FEED */}
              <Card title="RAW_FEED">
                <div className="h-64 overflow-y-auto border border-white/10 bg-[#050510] p-3 text-[10px] flex flex-col gap-2 scrollbar-hide">
                  {events.length === 0 ? (
                    <div className="text-white/30 italic tracking-wider">AWAITING_SIGNAL...</div>
                  ) : (
                    events.map((e, i) => {
                      const hash = i.toString(16).padStart(4, '0').toUpperCase();
                      return (
                        <div key={i} className="flex gap-2 whitespace-pre-wrap leading-tight">
                          <span className="text-[#00ff88]/40 shrink-0">[{hash}]</span>
                          <span className={`shrink-0 font-bold ${eventColor(e.type)}`}>{e.type}</span>
                          <span className="text-white/80">{summarizeEvent(e)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------
// Helper Components
// --------------------

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="border border-[#00ff88]/30 bg-black/60 p-5 relative backdrop-blur-sm shadow-[0_0_15px_rgba(0,255,136,0.05)]">
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[#00ff88]"></div>
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[#00ff88]"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-[#00ff88]"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[#00ff88]"></div>
      
      <div className="flex justify-between items-center mb-4">
        <h2 className={`${orbitron.className} text-lg text-[#00ff88] tracking-widest`} style={{ textShadow: "0 0 5px #00ff88" }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function StatusTriangle({ status }: { status: StepStatus }) {
  let color = "border-b-white/30";
  let dropShadow = "";
  if (status === "success") {
    color = "border-b-[#00ff88]";
    dropShadow = "drop-shadow(0 0 5px #00ff88)";
  } else if (status === "failed") {
    color = "border-b-[#ff0099]";
    dropShadow = "drop-shadow(0 0 5px #ff0099)";
  } else if (status === "running" || status === "waiting") {
    color = "border-b-[#0ff]";
    dropShadow = "drop-shadow(0 0 5px #0ff)";
  } else if (status === "skipped") {
    color = "border-b-white/10";
  }

  return (
    <div 
      className={`w-0 h-0 border-l-[8px] border-r-[8px] border-b-[14px] border-l-transparent border-r-transparent ${color} transition-all duration-300 rotate-90 ${status === "running" || status === "waiting" ? "animate-pulse" : ""}`}
      style={{ filter: dropShadow }}
    />
  );
}

function statusLabel(s: StepStatus): string {
  switch (s) {
    case "running": return "RUNNING...";
    case "waiting": return "AWAIT_HOOK";
    case "success": return "OK";
    case "failed": return "ERR_CRITICAL";
    case "skipped": return "BYPASSED";
    default: return "IDLE";
  }
}

function eventColor(type: OrderEvent["type"]): string {
  if (type === "step_failed" || type === "compensating") return "text-[#ff0099]";
  if (type === "step_succeeded" || type === "hook_resolved" || type === "compensated") return "text-[#00ff88]";
  if (type === "waiting_for_hook") return "text-[#0ff]";
  if (type === "done") return "text-white";
  return "text-white/50";
}

function summarizeEvent(e: OrderEvent): string {
  switch (e.type) {
    case "step_running":
    case "step_succeeded":
    case "step_failed":
    case "step_skipped":
      return `${e.label}${"detail" in e && e.detail ? ` -> ${e.detail}` : ""}${"error" in e && e.error ? ` -> [${e.error}]` : ""}`;
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
      return `${e.status.toUpperCase()} -> ${e.orderId}`;
    default:
      return "";
  }
}