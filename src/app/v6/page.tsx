"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
} from "@/workflows/place-order";

const MENU: OrderItem[] = [
  { id: "burger", name: "MEGA BURGER", price: 18, qty: 0 },
  { id: "fries", name: "LARGE FRIES", price: 6, qty: 0 },
  { id: "shake", name: "POWER SHAKE", price: 9, qty: 0 },
  { id: "soda", name: "COLD SODA", price: 4, qty: 0 },
];

const STEPS: { key: string; label: string }[] = [
  { key: "validateOrder", label: "01 VALIDATE" },
  { key: "chargePayment", label: "02 PAYMENT" },
  { key: "notifyRestaurant", label: "03 KITCHEN" },
  { key: "assignDriver", label: "04 COURIER" },
  { key: "trackDelivery", label: "05 TRANSIT" },
  { key: "sendReceipt", label: "06 RECEIPT" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "HAPPY PATH" },
  { value: "validateOrder", label: "FAIL AT VALIDATE" },
  { value: "chargePayment", label: "FAIL AT PAYMENT" },
  { value: "notifyRestaurant", label: "FAIL AT KITCHEN" },
  { value: "assignDriver", label: "FAIL AT COURIER" },
  { value: "sendReceipt", label: "FAIL AT RECEIPT" },
];

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

export default function BrutalistOrderPage() {
  const [cart, setCart] = useState<OrderItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "burger" ? 1 : 0 })),
  );
  const [customerName, setCustomerName] = useState("ADA LOVELACE");
  const [address, setAddress] = useState("123 CUPCAKE LANE, SF");
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

    const orderId = `V6_${Date.now().toString(36).toUpperCase()}`;
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
    <div className="min-h-screen bg-white p-4 font-sans font-black uppercase text-black lg:p-12">
      <header className="mb-12 border-b-8 border-black pb-4">
        <h1 className="text-6xl tracking-tighter sm:text-8xl lg:text-9xl">
          FOOD SAGA <span className="text-[#1d4ed8]">V6</span>
        </h1>
        <div className="mt-4 flex justify-between text-xl lg:text-3xl">
          <span>SYSTEM ID: {currentOrderId ?? "NULL"}</span>
          <span>48.8566° N, 2.3522° E</span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        {/* LEFT: CONFIGURATION */}
        <div className="space-y-12">
          {/* MENU BOX */}
          <Box title="01 / SELECT ASSETS" color="#1d4ed8">
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="flex border-4 border-black bg-white">
                  <div className="flex-1 p-4 text-2xl border-r-4 border-black">
                    {item.name}
                  </div>
                  <div className="p-4 text-2xl border-r-4 border-black w-24 text-center">
                    ${item.price}
                  </div>
                  <div className="flex">
                    <button 
                      onClick={() => updateQty(item.id, -1)}
                      className="w-12 h-full text-2xl hover:bg-black hover:text-white transition-colors"
                    >
                      -
                    </button>
                    <div className="w-12 h-full flex items-center justify-center border-x-4 border-black text-2xl">
                      {item.qty}
                    </div>
                    <button 
                      onClick={() => updateQty(item.id, 1)}
                      className="w-12 h-full text-2xl hover:bg-black hover:text-white transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              <div className="border-4 border-black bg-black p-4 text-white flex justify-between text-3xl">
                <span>TOTAL COST</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </Box>

          {/* LOGISTICS BOX */}
          <Box title="02 / LOGISTICS" color="#facc15">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xl">RECIPIENT_NAME</label>
                <input 
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value.toUpperCase())}
                  className="w-full border-4 border-black p-4 text-2xl focus:bg-[#1d4ed8] focus:text-white outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xl">DELIVERY_COORD</label>
                <input 
                  value={address}
                  onChange={e => setAddress(e.target.value.toUpperCase())}
                  className="w-full border-4 border-black p-4 text-2xl focus:bg-[#1d4ed8] focus:text-white outline-none"
                />
              </div>
            </div>
          </Box>

          {/* EXECUTION BOX */}
          <Box title="03 / COMMANDS" color="#ff2d16">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xl">FAILURE_SCENARIO</label>
                <select 
                  value={failAt ?? "null"}
                  onChange={e => setFailAt(e.target.value === "null" ? null : e.target.value as FailStep)}
                  className="w-full border-4 border-black p-4 text-2xl bg-white appearance-none cursor-pointer focus:bg-black focus:text-white outline-none"
                >
                  {FAIL_OPTIONS.map(opt => (
                    <option key={String(opt.value)} value={opt.value ?? "null"}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4 border-4 border-black p-4 cursor-pointer hover:bg-[#facc15]" onClick={() => setAutoAck(!autoAck)}>
                <div className={`w-8 h-8 border-4 border-black ${autoAck ? 'bg-black' : 'bg-white'}`} />
                <span className="text-xl">AUTO_ACKNOWLEDGE_PROCESS</span>
              </div>
              
              <div className="flex gap-4">
                <button 
                  onClick={placeOrder}
                  disabled={running || total === 0}
                  className="flex-1 bg-black text-white p-6 text-4xl hover:bg-[#1d4ed8] disabled:bg-gray-400 disabled:cursor-not-allowed shadow-[8px_8px_0_0_#ff2d16] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                >
                  {running ? "EXECUTING..." : "DEPLOY_SAGA"}
                </button>
                <button 
                  onClick={reset}
                  disabled={running}
                  className="border-4 border-black p-6 text-2xl hover:bg-[#ff2d16] disabled:opacity-50 shadow-[8px_8px_0_0_#000]"
                >
                  RESET
                </button>
              </div>
            </div>
          </Box>
        </div>

        {/* RIGHT: MONITORING */}
        <div className="space-y-12">
          {/* SAGA VISUALIZATION */}
          <Box 
            title="SAGA_PROCESS_MONITOR" 
            color="#000"
            status={result ? (result === 'completed' ? 'SUCCESS' : 'FAILURE') : (running ? 'ACTIVE' : 'IDLE')}
          >
            <div className="space-y-4">
              {STEPS.map((step, idx) => {
                const status = stepStatuses[step.key] ?? "pending";
                return (
                  <StepRow key={step.key} label={step.label} status={status} index={idx} />
                );
              })}
            </div>
            
            {compensations.length > 0 && (
              <div className="mt-8 border-4 border-[#ff2d16] p-4 bg-[#ff2d16] text-white">
                <h3 className="text-2xl mb-2">COMPENSATION_ACTIONS_DEPLOYED:</h3>
                <ul className="list-none space-y-1">
                  {compensations.map((c, i) => (
                    <li key={i} className="text-xl">{`> ${c.toUpperCase()}`}</li>
                  ))}
                </ul>
              </div>
            )}
          </Box>

          {/* MANUAL HOOKS */}
          <Box title="HOOK_OVERRIDE_PANEL" color="#facc15">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <HookButton onClick={() => resume("restaurant-accept", { accepted: true })} label="KITCHEN_ACCEPT" />
              <HookButton onClick={() => resume("restaurant-accept", { accepted: false, reason: "86'd" })} label="KITCHEN_REJECT" color="#ff2d16" />
              <HookButton onClick={() => resume("driver-accept", { accepted: true })} label="COURIER_ACCEPT" />
              <HookButton onClick={() => resume("driver-accept", { accepted: false })} label="COURIER_REJECT" color="#ff2d16" />
              <HookButton onClick={() => resume("delivered")} label="CONFIRM_DELIVERY" colSpan={2} color="#1d4ed8" />
            </div>
          </Box>

          {/* EVENT FEED */}
          <Box title="TELEMETRY_LOGS" color="#000">
            <div className="h-96 border-4 border-black bg-black p-4 font-mono text-sm overflow-auto space-y-2 selection:bg-[#facc15] selection:text-black">
              {events.length === 0 ? (
                <div className="text-gray-500 text-xl">LISTENING FOR EVENTS...</div>
              ) : (
                events.map((e, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="text-gray-500">[{new Date().toLocaleTimeString('en-GB')}]</span>
                    <span className={getEventColor(e.type)}>{e.type.toUpperCase().padEnd(20)}</span>
                    <span className="text-white">{summarizeEvent(e)}</span>
                  </div>
                ))
              )}
            </div>
          </Box>
        </div>
      </div>
      
      <footer className="mt-24 border-t-8 border-black pt-8 flex flex-col md:flex-row justify-between text-2xl gap-4 mb-24">
        <div>SAGA PROTOCOL V6.0.42</div>
        <div className="bg-black text-white px-4">STATUS: {running ? 'OPERATIONAL' : 'STANDBY'}</div>
        <div>STRICTLY FOR INTERNAL USE ONLY</div>
      </footer>

      <style jsx global>{`
        .fail-pattern {
          background-image: repeating-linear-gradient(45deg, #ff2d16, #ff2d16 10px, #000 10px, #000 20px);
        }
      `}</style>
    </div>
  );
}

function Box({ title, children, color, status }: { title: string; children: React.ReactNode; color: string; status?: string }) {
  return (
    <div className="border-4 border-black shadow-[8px_8px_0_0_#000] bg-white">
      <div className="border-b-4 border-black p-4 flex justify-between items-center" style={{ backgroundColor: color }}>
        <h2 className="text-3xl text-white mix-blend-difference leading-none">{title}</h2>
        {status && (
          <span className="bg-black text-white px-2 text-xl">{status}</span>
        )}
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function StepRow({ label, status, index }: { label: string; status: StepStatus; index: number }) {
  const isFailed = status === 'failed';
  const isRunning = status === 'running' || status === 'waiting';
  const isSuccess = status === 'success';
  
  return (
    <div className={`border-4 border-black p-4 flex justify-between items-center transition-all ${isFailed ? 'fail-pattern text-white' : 'bg-white'}`}>
      <div className="flex items-center gap-4">
        <span className="text-3xl font-black">{label}</span>
      </div>
      <div className="flex items-center gap-4">
        {isRunning && <span className="animate-pulse bg-[#1d4ed8] text-white px-2 text-xl">ACTIVE</span>}
        {isSuccess && <span className="bg-black text-white px-2 text-xl">OK</span>}
        {isFailed && <span className="bg-white text-black px-2 text-xl border-4 border-black">FAIL</span>}
        {status === 'pending' && <span className="text-gray-300">....</span>}
        {status === 'skipped' && <span className="line-through text-gray-400">SKIPPED</span>}
      </div>
    </div>
  );
}

function HookButton({ onClick, label, colSpan = 1, color = "#000" }: { onClick: () => void; label: string; colSpan?: number; color?: string }) {
  return (
    <button 
      onClick={onClick}
      className={`border-4 border-black p-4 text-xl hover:bg-black hover:text-white transition-all shadow-[4px_4px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none`}
      style={{ gridColumn: colSpan === 2 ? 'span 2' : 'auto', borderLeftColor: color }}
    >
      {label}
    </button>
  );
}

function getEventColor(type: OrderEvent["type"]): string {
  if (type === "step_failed" || type === "compensating") return "text-[#ff2d16]";
  if (type === "step_succeeded" || type === "hook_resolved" || type === "compensated") return "text-emerald-400";
  if (type === "waiting_for_hook") return "text-[#facc15]";
  if (type === "done") return "text-[#1d4ed8]";
  return "text-gray-400";
}

function summarizeEvent(e: OrderEvent): string {
  switch (e.type) {
    case "step_running":
    case "step_succeeded":
    case "step_failed":
    case "step_skipped":
      return `${e.label.toUpperCase()}${"detail" in e && e.detail ? ` > ${e.detail.toUpperCase()}` : ""}${
        "error" in e && e.error ? ` > ${e.error.toUpperCase()}` : ""
      }`;
    case "waiting_for_hook":
      return `AWAITING EXTERNAL HOOK: ${e.label.toUpperCase()}`;
    case "hook_resolved":
      return `HOOK RESOLVED: ${e.detail?.toUpperCase() ?? e.token}`;
    case "compensation_pushed":
      return `COMPENSATION QUEUED: ${e.action.toUpperCase()}`;
    case "compensating":
      return `EXECUTING COMPENSATION: ${e.action.toUpperCase()}`;
    case "compensated":
      return `COMPENSATION COMPLETED: ${e.action.toUpperCase()}`;
    case "log":
      return e.message.toUpperCase();
    case "done":
      return `PROCESS TERMINATED: ${e.status.toUpperCase()}`;
    default:
      return "";
  }
}
