"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import type { FailStep, OrderEvent, OrderInput, OrderItem } from "@/workflows/place-order";

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

const MENU = [
  { id: "e3b0c44", name: "The Deployer", price: 14, qty: 0, tag: "main" },
  { id: "f2a71d8", name: "Edge Runtime", price: 10, qty: 0, tag: "feature/edge" },
  { id: "c89f3b1", name: "Cold Start", price: 8, qty: 0, tag: "experimental" },
  { id: "a54d8e9", name: "Serverless Sprinkle", price: 12, qty: 0, tag: "main" },
  { id: "b1c2d3e", name: "ISR Glaze", price: 11, qty: 0, tag: "fix/caching" },
];

const STEPS: { key: string; label: string }[] = [
  { key: "validateOrder", label: "Validate order" },
  { key: "chargePayment", label: "Charge payment" },
  { key: "notifyRestaurant", label: "Notify restaurant" },
  { key: "assignDriver", label: "Assign driver" },
  { key: "trackDelivery", label: "Track delivery" },
  { key: "sendReceipt", label: "Send receipt" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "Happy path" },
  { value: "validateOrder", label: "Fail at validate" },
  { value: "chargePayment", label: "Fail at payment" },
  { value: "notifyRestaurant", label: "Fail at restaurant" },
  { value: "assignDriver", label: "Fail at driver" },
  { value: "sendReceipt", label: "Fail at receipt" },
];

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

export default function VercelDashboardDemo() {
  const [cart, setCart] = useState(
    MENU.map((m) => ({ ...m, qty: m.id === "e3b0c44" ? 1 : 0 })),
  );
  const [customerName, setCustomerName] = useState("Guillermo Rauch");
  const [address, setAddress] = useState("Vercel HQ, San Francisco");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [result, setResult] = useState<"completed" | "rolled_back" | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<string>("0.0s");
  const abortRef = useRef<AbortController | null>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const totalItems = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

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
    setStartTime(null);
    setElapsed("0.0s");
  };

  useEffect(() => {
    let animationFrameId: number;
    const updateElapsed = () => {
      if (startTime && running) {
        const now = Date.now();
        const diff = (now - startTime) / 1000;
        setElapsed(`${diff.toFixed(1)}s`);
        animationFrameId = requestAnimationFrame(updateElapsed);
      }
    };
    if (running && startTime) {
      animationFrameId = requestAnimationFrame(updateElapsed);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [running, startTime]);

  useEffect(() => {
    if (feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events]);

  const placeOrder = useCallback(async () => {
    reset();
    setRunning(true);
    setStartTime(Date.now());

    const orderId = `ord_${Date.now().toString(36)}`;
    setCurrentOrderId(orderId);

    const items: OrderItem[] = cart
      .filter((i) => i.qty > 0)
      .map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty }));

    const input: OrderInput = {
      orderId,
      customerName,
      address,
      items,
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
              ? "restaurant-accept"
              : event.step === "assignDriver"
                ? "driver-accept"
                : "delivered";
          setTimeout(() => {
            void resume(kind as any, kind === "delivered" ? {} : { accepted: true });
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

  const getPhoneStatus = () => {
    if (result === "completed") return { label: "Ready", color: "text-emerald-400" };
    if (result === "rolled_back" || Object.values(stepStatuses).includes("failed")) return { label: "Error", color: "text-rose-500" };
    if (running) return { label: "Building", color: "text-amber-400" };
    return { label: "Idle", color: "text-zinc-500" };
  };

  const phoneStatus = getPhoneStatus();

  return (
    <div className={`min-h-screen bg-black text-white ${geist.className} p-8 lg:p-16 flex flex-col xl:flex-row gap-16 justify-center items-start max-w-[2400px] mx-auto overflow-x-hidden`}>
      {/* PHONE WRAPPER */}
      <div className="shrink-0 w-[600px] bg-[#000] border border-white/10 rounded-[48px] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(255,255,255,0.05)] ring-1 ring-white/5 h-[1200px]">
        {/* Status Bar */}
        <div className="h-16 bg-[#0a0a0a] border-b border-white/10 flex items-center px-8 justify-between shrink-0">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="#ffffff" />
            </svg>
            <span className="text-2xl font-semibold tracking-wide">triangledonuts</span>
          </div>
          <div className={`flex items-center gap-3 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-xl font-medium ${phoneStatus.color}`}>
            <span className="text-2xl leading-none">&bull;</span> {phoneStatus.label}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10 flex flex-col gap-12">
          {/* Header */}
          <div>
            <h1 className="text-5xl font-bold tracking-tight mb-4">New Deployment</h1>
            <p className="text-2xl text-zinc-400">Select donuts to preview and deploy your order to the edge.</p>
          </div>

          {/* Menu List */}
          <div className="flex flex-col gap-6">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-6 bg-[#0a0a0a] border border-white/10 rounded-2xl hover:border-white/30 transition-colors">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    <span className={`${geistMono.className} text-xl text-zinc-500`}>{item.id}</span>
                    <span className="text-3xl font-semibold">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xl text-zinc-300">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v12" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>
                      {item.tag}
                    </div>
                    <span className="text-2xl text-zinc-400">${item.price.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 border border-white/10 rounded-xl p-2 bg-black">
                  <button onClick={() => updateQty(item.id, -1)} className="w-12 h-12 flex items-center justify-center text-4xl hover:bg-white/10 rounded-lg transition-colors">&minus;</button>
                  <span className={`${geistMono.className} text-3xl w-8 text-center`}>{item.qty}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="w-12 h-12 flex items-center justify-center text-4xl hover:bg-white/10 rounded-lg transition-colors">+</button>
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="flex flex-col gap-8 bg-[#0a0a0a] border border-white/10 rounded-2xl p-8">
            <h2 className="text-3xl font-semibold">Environment Variables</h2>
            <div className="flex flex-col gap-4">
              <label className="text-xl text-zinc-400 font-medium">CUSTOMER_NAME</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={`bg-black border border-white/10 rounded-xl px-6 py-5 text-2xl focus:outline-none focus:border-white transition-colors ${geistMono.className}`}
              />
            </div>
            <div className="flex flex-col gap-4">
              <label className="text-xl text-zinc-400 font-medium">DELIVERY_ADDRESS</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`bg-black border border-white/10 rounded-xl px-6 py-5 text-2xl focus:outline-none focus:border-white transition-colors ${geistMono.className}`}
              />
            </div>
          </div>

          {/* Total & Submit */}
          <div className="mt-auto pt-8 border-t border-white/10 flex flex-col gap-8">
            <div className="flex items-end justify-between">
              <span className="text-3xl text-zinc-400">{totalItems} items selected</span>
              <span className="text-5xl font-bold tracking-tight">${total.toFixed(2)}</span>
            </div>
            <button
              onClick={placeOrder}
              disabled={running || total === 0}
              className="w-full bg-white text-black py-6 rounded-2xl text-3xl font-bold tracking-wide hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4"
            >
              {running ? (
                <>
                  <svg className="animate-spin h-8 w-8 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Building...
                </>
              ) : "Deploy Order"}
            </button>
          </div>
        </div>
      </div>

      {/* DASHBOARD WRAPPER */}
      <div className="flex-1 w-full min-w-[800px] flex flex-col gap-10">
        
        {/* Settings Card */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 flex flex-wrap items-center gap-12">
          <div className="flex flex-col gap-4 flex-1 min-w-[300px]">
            <label className="text-2xl font-semibold text-white">Target Fail Step</label>
            <select
              value={failAt ?? "null"}
              onChange={(e) => setFailAt(e.target.value === "null" ? null : (e.target.value as FailStep))}
              className="bg-black border border-white/10 rounded-xl px-6 py-4 text-2xl focus:outline-none focus:border-white transition-colors cursor-pointer appearance-none"
            >
              {FAIL_OPTIONS.map((opt) => (
                <option key={String(opt.value)} value={opt.value ?? "null"}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-6 mt-8">
            <div
              onClick={() => setAutoAck(!autoAck)}
              className={`w-20 h-10 rounded-full flex items-center px-1 cursor-pointer transition-colors ${autoAck ? 'bg-white' : 'bg-zinc-800'}`}
            >
              <div className={`w-8 h-8 rounded-full bg-black transition-transform ${autoAck ? 'translate-x-10' : 'translate-x-0'}`} />
            </div>
            <span className="text-2xl font-medium">Auto-resolve webhooks</span>
          </div>
          <div className="ml-auto mt-8">
            <button onClick={reset} disabled={running} className="border border-white/20 hover:bg-white/10 px-8 py-4 rounded-xl text-2xl font-medium transition-colors disabled:opacity-50">
              Reset Deployment
            </button>
          </div>
        </div>

        {/* Main Deployment Card */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
          {/* Card Header */}
          <div className="border-b border-white/10 px-10 py-8 flex items-center justify-between bg-black/50">
            <div>
              <h2 className="text-4xl font-bold tracking-tight">Deployment {currentOrderId || "Draft"}</h2>
              <p className="text-2xl text-zinc-500 mt-2">Execution Pipeline</p>
            </div>
            <div className={`${geistMono.className} text-3xl font-bold tracking-wider text-white bg-white/5 border border-white/10 px-6 py-3 rounded-xl`}>
              {elapsed}
            </div>
          </div>

          <div className="flex flex-col xl:flex-row divide-y xl:divide-y-0 xl:divide-x divide-white/10 h-[700px]">
            {/* Timeline Left Pane */}
            <div className="w-full xl:w-[450px] shrink-0 p-10 overflow-y-auto bg-black/20">
              <h3 className="text-2xl font-semibold mb-10 tracking-widest uppercase text-zinc-500">Build Steps</h3>
              <div className="flex flex-col gap-10 relative">
                {/* Vertical Line */}
                <div className="absolute left-[23px] top-[24px] bottom-[24px] w-0.5 bg-white/10 -z-10" />

                {STEPS.map((step) => {
                  const status = stepStatuses[step.key] ?? "pending";
                  const isPending = status === "pending";
                  const isRunning = status === "running";
                  const isWaiting = status === "waiting";
                  const isSuccess = status === "success";
                  const isFailed = status === "failed";
                  const isSkipped = status === "skipped";

                  let iconColor = "text-zinc-700";
                  let textColor = "text-zinc-500";
                  let detailColor = "text-zinc-600";
                  let detailText = "Pending execution";
                  let Triangle = "△";

                  if (isRunning) { iconColor = "text-sky-400 animate-pulse"; textColor = "text-white"; detailColor = "text-sky-400"; detailText = "Building..."; Triangle = "▲"; }
                  if (isWaiting) { iconColor = "text-amber-400 animate-pulse"; textColor = "text-white"; detailColor = "text-amber-400"; detailText = "Awaiting webhook..."; Triangle = "▲"; }
                  if (isSuccess) { iconColor = "text-emerald-400"; textColor = "text-white"; detailColor = "text-emerald-400"; detailText = "Completed in ~ms"; Triangle = "▲"; }
                  if (isFailed) { iconColor = "text-rose-500"; textColor = "text-rose-500"; detailColor = "text-rose-500"; detailText = "Execution failed"; Triangle = "▲"; }
                  if (isSkipped) { iconColor = "text-zinc-600 opacity-50"; textColor = "text-zinc-600"; detailColor = "text-zinc-600"; detailText = "Skipped by orchestrator"; Triangle = "△"; }

                  return (
                    <div key={step.key} className="flex items-start gap-8 bg-[#0a0a0a] xl:bg-transparent p-4 xl:p-0 rounded-xl xl:rounded-none z-10">
                      <div className={`text-5xl bg-[#0a0a0a] xl:bg-transparent ${iconColor}`}>
                        {Triangle}
                      </div>
                      <div className="flex flex-col gap-2 mt-2">
                        <span className={`text-3xl font-semibold tracking-tight ${textColor}`}>{step.label}</span>
                        <span className={`text-xl ${geistMono.className} ${detailColor}`}>{detailText}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {compensations.length > 0 && (
                <div className="mt-12 p-6 rounded-2xl border border-rose-500/30 bg-rose-500/10">
                  <h4 className="text-2xl font-bold text-rose-400 mb-4 flex items-center gap-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
                    Compensations Executed
                  </h4>
                  <ul className="flex flex-col gap-3 text-xl text-rose-300 list-disc pl-6">
                    {compensations.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Event Logs Right Pane */}
            <div className="flex-1 flex flex-col bg-black overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black to-transparent z-10 pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />
              
              <div className="flex-1 overflow-y-auto p-10 flex flex-col gap-2">
                {events.length === 0 ? (
                  <div className="text-2xl text-zinc-600 m-auto">Waiting for deployment to start...</div>
                ) : (
                  events.map((e, i) => {
                    let badgeColor = "border-zinc-700 text-zinc-400";
                    let msgColor = "text-zinc-300";

                    if (e.type === "step_failed" || e.type === "compensating") { badgeColor = "border-rose-500/50 text-rose-400 bg-rose-500/10"; msgColor = "text-rose-400"; }
                    if (e.type === "step_succeeded" || e.type === "hook_resolved" || e.type === "compensated") { badgeColor = "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"; msgColor = "text-white"; }
                    if (e.type === "waiting_for_hook") { badgeColor = "border-amber-400/50 text-amber-400 bg-amber-400/10"; msgColor = "text-amber-100"; }
                    if (e.type === "done") { badgeColor = "border-sky-400/50 text-sky-400 bg-sky-400/10"; msgColor = "text-sky-300 font-bold"; }

                    return (
                      <div key={i} className="flex items-start gap-6 py-4 hover:bg-white/[0.02] px-4 rounded-xl transition-colors">
                        <span className={`${geistMono.className} text-xl text-zinc-600 shrink-0 mt-1`}>
                          {new Date().toISOString().substring(11, 23)}
                        </span>
                        <span className={`px-3 py-1 rounded-full border text-lg uppercase tracking-wider font-semibold shrink-0 mt-0.5 ${badgeColor}`}>
                          {e.type.replace(/_/g, ' ')}
                        </span>
                        <span className={`${geistMono.className} text-2xl ${msgColor} break-all mt-0.5 leading-relaxed`}>
                          {summarizeEvent(e)}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={feedEndRef} />
              </div>
            </div>
          </div>
        </div>

        {/* Manual Overrides Card */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-10 flex flex-col gap-8 shadow-2xl">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Manual Hook Overrides</h2>
            <p className="text-xl text-zinc-500">Inject external events to resolve suspended workflows. Ensure auto-ack is disabled.</p>
          </div>
          
          <div className="flex flex-wrap gap-6">
            <button onClick={() => resume("restaurant-accept", { accepted: true })} className="px-8 py-5 rounded-2xl border border-white/20 hover:bg-white text-white hover:text-black text-xl font-bold transition-all">
              Restaurant: Accept
            </button>
            <button onClick={() => resume("restaurant-accept", { accepted: false, reason: "Out of stock" })} className="px-8 py-5 rounded-2xl border border-rose-500/50 hover:bg-rose-500 text-rose-400 hover:text-white text-xl font-bold transition-all">
              Restaurant: Reject
            </button>
            <button onClick={() => resume("driver-accept", { accepted: true })} className="px-8 py-5 rounded-2xl border border-white/20 hover:bg-white text-white hover:text-black text-xl font-bold transition-all">
              Driver: Accept
            </button>
            <button onClick={() => resume("driver-accept", { accepted: false })} className="px-8 py-5 rounded-2xl border border-rose-500/50 hover:bg-rose-500 text-rose-400 hover:text-white text-xl font-bold transition-all">
              Driver: Decline
            </button>
            <button onClick={() => resume("delivered")} className="px-8 py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black text-xl font-bold transition-all">
              Mark Delivered
            </button>
          </div>
        </div>

      </div>
    </div>
  );
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
      return `${e.label} [Token: ${e.token}]`;
    case "hook_resolved":
      return e.detail ?? `Resolved hook ${e.token}`;
    case "compensation_pushed":
      return `Registered ${e.action} (for ${e.forStep})`;
    case "compensating":
    case "compensated":
      return e.action;
    case "log":
      return e.message;
    case "done":
      return `Pipeline ${e.status.toUpperCase()} — Run ID: ${e.orderId}`;
    default:
      return "";
  }
}
