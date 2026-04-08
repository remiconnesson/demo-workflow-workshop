"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
} from "@/workflows/place-order";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "700"] });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"] });

const MENU: (OrderItem & { desc: string })[] = [
  { id: "deployer", name: "The Deployer", price: 4.5, qty: 1, desc: "Classic triangle-cut glazed" },
  { id: "edge", name: "Edge Runtime", price: 5.0, qty: 0, desc: "Spicy jalapeño glaze" },
  { id: "cold", name: "Cold Start", price: 4.0, qty: 0, desc: "Vanilla frost triangle" },
  { id: "hot", name: "Hot Module", price: 5.5, qty: 0, desc: "Molten chocolate core" },
  { id: "serverless", name: "Serverless Sprinkle", price: 4.5, qty: 0, desc: "Rainbow triangles" },
  { id: "hydration", name: "Hydration Hole", price: 4.0, qty: 0, desc: "Water-glazed ring cut into a triangle" },
];

const STEPS: { key: string; label: string }[] = [
  { key: "validateOrder", label: "Dough check" },
  { key: "chargePayment", label: "Payment" },
  { key: "notifyRestaurant", label: "Baking" },
  { key: "assignDriver", label: "Courier dispatched" },
  { key: "trackDelivery", label: "En route" },
  { key: "sendReceipt", label: "Delivered" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "NULL (Happy path)" },
  { value: "validateOrder", label: "ERR_1 (Fail at Dough check)" },
  { value: "chargePayment", label: "ERR_2 (Fail at Payment)" },
  { value: "notifyRestaurant", label: "ERR_3 (Fail at Baking)" },
  { value: "assignDriver", label: "ERR_4 (Fail at Dispatch)" },
  { value: "sendReceipt", label: "ERR_5 (Fail at Receipt)" },
];

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

export default function BlueprintDemo() {
  const [cart, setCart] = useState<(OrderItem & { desc: string })[]>(MENU);
  const [customerName, setCustomerName] = useState("A. Lovelace");
  const [address, setAddress] = useState("Sector 7G, VercelHQ");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [result, setResult] = useState<"completed" | "rolled_back" | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);
  
  const abortRef = useRef<AbortController | null>(null);
  const autoAckRef = useRef(autoAck);
  const currentOrderIdRef = useRef(currentOrderId);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => { autoAckRef.current = autoAck; }, [autoAck]);
  useEffect(() => { currentOrderIdRef.current = currentOrderId; }, [currentOrderId]);
  useEffect(() => { eventsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [events]);

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const totalItems = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  const updateQty = (id: string, delta: number) => {
    setCart((c) => c.map((i) => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i));
  };

  const reset = () => {
    abortRef.current?.abort();
    setEvents([]);
    setStepStatuses({});
    setResult(null);
    setCompensations([]);
    setCurrentOrderId(null);
    setRunning(false);
  };

  const resume = useCallback(async (
    kind: "restaurant-accept" | "driver-accept" | "delivered",
    payload: object = {},
  ) => {
    if (!currentOrderIdRef.current) return;
    await fetch(`/api/orders/${currentOrderIdRef.current}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
  }, []);

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
        if (autoAckRef.current) {
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
  }, [resume]);

  const placeOrder = useCallback(async () => {
    reset();
    setRunning(true);

    const orderId = `ord_${Date.now().toString(36)}`;
    setCurrentOrderId(orderId);

    const input: OrderInput = {
      orderId,
      customerName,
      address,
      items: cart.filter((i) => i.qty > 0).map(({ id, name, price, qty }) => ({ id, name, price, qty })),
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
  }, [cart, customerName, address, failAt, autoAck, applyEvent]);

  const isTracking = running || result !== null;

  return (
    <div className="min-h-screen blueprint-bg text-sky-100 p-4 md:p-8 font-sans selection:bg-sky-500/30 overflow-x-hidden">
      <style dangerouslySetInnerHTML={{__html: `
        .blueprint-bg {
          background-color: #0b2f5c;
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(rgba(255, 255, 255, 0.1) 2px, transparent 2px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 2px, transparent 2px);
          background-size: 20px 20px, 20px 20px, 100px 100px, 100px 100px;
          background-attachment: fixed;
        }
        .blueprint-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .blueprint-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .blueprint-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }
      `}} />

      <header className="border-b border-white/20 pb-4 mb-8 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`${spaceGrotesk.className} text-3xl uppercase tracking-widest font-bold text-white flex items-center gap-4`}>
              <svg width="32" height="32" viewBox="0 0 100 100" className="stroke-white fill-none stroke-2">
                <polygon points="50,10 90,90 10,90" />
                <line x1="50" y1="10" x2="50" y2="90" className="stroke-white/50" strokeDasharray="4 4" />
                <line x1="10" y1="90" x2="90" y2="90" className="stroke-white/50" strokeDasharray="4 4" />
              </svg>
              Triangle Donuts
            </h1>
            <p className={`${ibmPlexMono.className} text-sky-300/70 text-xs mt-2 uppercase tracking-widest`}>
              Proj. Ref: TD-2026 // Schema 17 // Saga Workflow Demo
            </p>
          </div>
        </div>
      </header>

      <main className="flex flex-col xl:flex-row gap-12 max-w-[1400px] mx-auto items-start">
        {/* LEFT: Phone Mockup */}
        <div className="w-full xl:w-[400px] flex justify-center flex-shrink-0">
          <div className="relative w-[375px] h-[812px] flex-shrink-0">
            {/* Annotations */}
            <div className={`${ibmPlexMono.className} absolute -top-8 left-0 right-0 flex items-center text-[10px] text-white/50`}>
              <span>|</span><div className="flex-1 border-t border-white/30 border-dashed mx-2"></div><span>W=375mm</span><div className="flex-1 border-t border-white/30 border-dashed mx-2"></div><span>|</span>
            </div>
            <div className={`${ibmPlexMono.className} absolute -left-12 top-0 bottom-0 flex flex-col items-center justify-between text-[10px] text-white/50`}>
              <span>_</span>
              <div className="flex-1 border-l border-white/30 border-dashed my-2"></div>
              <span className="-rotate-90 origin-center whitespace-nowrap">H=812mm</span>
              <div className="flex-1 border-l border-white/30 border-dashed my-2"></div>
              <span>_</span>
            </div>

            {/* Device Frame */}
            <div className="absolute inset-0 border-[3px] border-white rounded-[45px] p-2 overflow-hidden bg-[#0b2f5c] shadow-[0_0_50px_rgba(255,255,255,0.05)]">
              {/* Screen Inner */}
              <div className="relative w-full h-full border border-white/20 rounded-[35px] overflow-hidden flex flex-col bg-[#0b2f5c] blueprint-bg">
                {/* Dynamic Island */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[100px] h-[25px] rounded-full border border-white/50 z-20 flex items-center justify-center bg-[#0b2f5c]">
                  <div className="w-12 h-[1px] bg-white/30"></div>
                </div>
                <div className="absolute top-4 right-10 w-20 border-t border-white/50 z-20"></div>
                <span className={`${ibmPlexMono.className} absolute top-2 right-4 text-[8px] text-white/60 z-20`}>FIG.1</span>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto mt-10 p-5 blueprint-scroll relative z-10">
                  {!isTracking ? (
                    <div className="animate-in fade-in space-y-6">
                      <div className="flex items-center gap-4 border border-white/20 p-4 relative mb-8 mt-2">
                        <span className="absolute -top-2 -left-2 bg-[#0b2f5c] px-1 text-[8px] font-mono text-white/50">BRAND.ID</span>
                        <svg width="40" height="40" viewBox="0 0 100 100" className="stroke-white fill-none stroke-1 flex-shrink-0">
                          <line x1="0" y1="50" x2="100" y2="50" className="stroke-white/30 stroke-dashed" />
                          <line x1="50" y1="0" x2="50" y2="100" className="stroke-white/30 stroke-dashed" />
                          <polygon points="50,10 90,90 10,90" className="stroke-2" />
                          <circle cx="50" cy="63" r="15" className="stroke-white/50" />
                        </svg>
                        <div>
                          <h1 className={`${spaceGrotesk.className} text-lg uppercase tracking-widest font-bold text-white leading-tight`}>
                            Triangle Donuts
                          </h1>
                          <div className="text-[8px] font-mono text-white/50 mt-1 uppercase tracking-widest">Geometric Confectionery</div>
                        </div>
                      </div>

                      <div className="text-center mb-6">
                        <h2 className={`${spaceGrotesk.className} text-xl font-bold uppercase text-white tracking-widest`}>Spec Sheet / Menu</h2>
                        <div className="h-px bg-white/20 w-16 mx-auto mt-2"></div>
                      </div>
                      
                      <div className="space-y-4">
                        {cart.map(item => (
                          <div key={item.id} className="border border-white/20 p-3 flex gap-3 relative">
                            <span className="absolute -top-2 -left-2 bg-[#0b2f5c] px-1 text-[8px] font-mono text-white/50 uppercase tracking-widest">FIG. {item.id.substring(0,3)}</span>
                            
                            <div className="w-14 h-14 flex-shrink-0 border border-white/20 flex items-center justify-center relative">
                              <span className="absolute top-0.5 left-1 text-[5px] font-mono text-white/40">TOP</span>
                              <span className="absolute bottom-0.5 right-1 text-[5px] font-mono text-white/40">Ø=80</span>
                              <svg viewBox="0 0 100 100" className="w-10 h-10 stroke-white fill-none stroke-1">
                                <polygon points="50,15 85,85 15,85" />
                                <circle cx="50" cy="62" r="12" className="stroke-white/50 stroke-dashed" />
                                <line x1="50" y1="15" x2="50" y2="85" className="stroke-white/30" strokeDasharray="2 2" />
                              </svg>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className={`${ibmPlexMono.className} text-xs font-semibold text-white uppercase truncate`}>{item.name}</div>
                              <div className="text-[9px] font-mono text-white/50 mt-0.5 leading-tight">{item.desc}</div>
                              <div className="text-[10px] font-mono text-white/80 mt-1">${item.price.toFixed(2)}</div>
                            </div>
                            
                            <div className="flex flex-col items-center justify-between flex-shrink-0">
                              <button onClick={() => updateQty(item.id, 1)} className="border border-white/40 w-5 h-5 flex items-center justify-center text-xs hover:bg-white/10 transition-colors">+</button>
                              <span className="font-mono text-xs">{item.qty}</span>
                              <button onClick={() => updateQty(item.id, -1)} className="border border-white/40 w-5 h-5 flex items-center justify-center text-xs hover:bg-white/10 transition-colors">-</button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-8 border-t border-white/20 pt-6">
                        <div className="flex justify-between font-mono text-xs mb-6">
                          <span>TOTAL QUANTITY: {totalItems}</span>
                          <span>EST: ${total.toFixed(2)}</span>
                        </div>
                        
                        <div className="space-y-5 font-mono text-xs">
                          <div>
                            <label className="text-white/50 block mb-1">CUST. DESIGNATION</label>
                            <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-transparent border-b border-white/30 focus:border-white outline-none py-1 text-white" />
                          </div>
                          <div>
                            <label className="text-white/50 block mb-1">DEST. COORDINATES</label>
                            <input value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-transparent border-b border-white/30 focus:border-white outline-none py-1 text-white" />
                          </div>
                        </div>

                        <button 
                          onClick={placeOrder} 
                          disabled={total === 0 || running} 
                          className="mt-8 w-full border-2 border-white py-3 font-bold uppercase tracking-widest text-sm hover:bg-white hover:text-[#0b2f5c] transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white disabled:cursor-not-allowed">
                          Execute Order
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="animate-in fade-in flex flex-col h-full">
                      <h2 className={`${spaceGrotesk.className} text-xl font-bold uppercase text-white tracking-widest text-center mt-2 mb-2`}>Telemetry</h2>
                      <div className="h-px bg-white/20 w-16 mx-auto mb-8"></div>
                      
                      <div className="flex-1 flex flex-col">
                        <div className="relative border border-white/20 p-4 mb-8 bg-[#0b2f5c] shadow-inner">
                          <span className="absolute -top-2 -left-2 bg-[#0b2f5c] px-1 text-[8px] font-mono text-white/50">FIG. 3 - ACTIVE DEPLOYMENT</span>
                          <div className="aspect-square w-full border border-white/10 relative overflow-hidden flex items-center justify-center">
                            <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                            
                            <svg viewBox="0 0 200 200" className="w-full h-full absolute inset-0 z-10">
                              <path d="M 40,160 L 40,40 L 160,40 L 160,160" fill="none" className="stroke-white/30 stroke-dashed stroke-2" />
                              
                              <circle cx="40" cy="160" r="6" className="fill-sky-400" />
                              <text x="40" y="178" fill="white" fontSize="8" className="font-mono" textAnchor="middle">BAKERY</text>
                              
                              <circle cx="160" cy="160" r="6" className="fill-emerald-400" />
                              <text x="160" y="178" fill="white" fontSize="8" className="font-mono" textAnchor="middle">DEST</text>

                              {running && (
                                <g>
                                  <polygon points="-8,8 0,-8 8,8" className="fill-white drop-shadow-md">
                                    <animateMotion path="M 40,160 L 40,40 L 160,40 L 160,160" dur="10s" repeatCount="indefinite" />
                                  </polygon>
                                </g>
                              )}
                              {result === 'completed' && (
                                <polygon points="154,166 160,150 166,166" className="fill-white drop-shadow-md" />
                              )}
                            </svg>
                          </div>
                        </div>

                        <div className="space-y-4 flex-1 font-mono text-xs mb-8">
                          {STEPS.map((step) => {
                            const status = stepStatuses[step.key] || 'pending';
                            return (
                              <div key={step.key} className="flex gap-3 items-center border-l border-white/30 pl-4 relative py-1">
                                <div className={`absolute -left-[5px] w-2 h-2 rounded-full ${
                                  status === 'running' || status === 'waiting' ? 'bg-sky-400 animate-pulse shadow-[0_0_8px_#38bdf8]' :
                                  status === 'success' ? 'bg-emerald-400' :
                                  status === 'failed' ? 'bg-rose-400' : 'bg-[#0b2f5c] border border-white/50'
                                }`}></div>
                                <div className={`flex-1 uppercase tracking-wider ${status === 'pending' ? 'text-white/30' : 'text-white'}`}>{step.label}</div>
                                <div className={`text-[9px] ${status === 'pending' ? 'text-white/20' : 'text-white/60'}`}>{status}</div>
                              </div>
                            )
                          })}
                        </div>

                        <button onClick={reset} className="mt-auto w-full border border-white/40 py-3 uppercase tracking-widest text-xs hover:bg-white/10 transition-colors">
                          Terminate & Reset
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Callouts */}
            <div className="absolute -right-20 top-32 flex items-center hidden xl:flex">
              <div className="w-16 border-t border-white/40"></div>
              <span className={`${ibmPlexMono.className} text-[10px] text-white/60 ml-2`}>R=45</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Dashboard */}
        <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* DIAGRAM & CONTROLS */}
          <div className="space-y-8">
            {/* SAGA NODE DIAGRAM */}
            <div className="border border-white/20 p-6 relative bg-[#0b2f5c]/40">
              <span className={`${ibmPlexMono.className} absolute -top-2 -left-2 bg-[#0b2f5c] px-1 text-[10px] text-white/50`}>FIG. 4 - SAGA GRAPH</span>
              
              <div className="flex flex-col space-y-6 relative mt-4 pb-4">
                <div className="absolute left-[15px] top-[10px] bottom-[10px] w-px bg-white/20 border-l border-white/20 border-dashed z-0"></div>
                
                {STEPS.map((step, i) => {
                  const status = stepStatuses[step.key] || 'pending';
                  return (
                    <div key={step.key} className="flex items-center gap-6 relative z-10">
                        <div className="bg-[#0b2f5c] p-1">
                          <svg width="24" height="24" viewBox="0 0 32 32" className={`${
                              status === 'running' || status === 'waiting' ? 'animate-pulse' : ''
                          }`}>
                            <polygon points="16,4 28,26 4,26" className={`stroke-2 ${
                                status === 'success' ? 'stroke-emerald-400 fill-emerald-400/20' :
                                status === 'failed' ? 'stroke-rose-400 fill-rose-400/20' :
                                status === 'running' || status === 'waiting' ? 'stroke-sky-400 fill-sky-400/20' :
                                status === 'skipped' ? 'stroke-white/20 fill-transparent' :
                                'stroke-white/40 fill-transparent'
                            }`} strokeLinejoin="round" />
                          </svg>
                        </div>
                        <div>
                          <div className={`${ibmPlexMono.className} text-[10px] text-sky-300/80 mb-1`}>REV 1.{i} : {step.key}</div>
                          <div className={`${spaceGrotesk.className} uppercase tracking-wider text-sm ${status === 'pending' ? 'text-white/40' : 'text-white'}`}>{step.label}</div>
                        </div>
                    </div>
                  )
                })}

                {/* Rollback/Compensations Overlay */}
                {compensations.length > 0 && (
                  <div className="absolute right-0 top-12 bottom-12 w-8 border-r-2 border-dashed border-rose-400 flex items-start justify-end z-20">
                    <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-rose-400 absolute -top-2 right-[-7px]"></div>
                    <div className={`${ibmPlexMono.className} text-[10px] text-rose-400 rotate-90 origin-right translate-x-8 mt-12 whitespace-nowrap`}>
                      ROLLBACK EXECUTED
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* MANUAL CONTROLS */}
            <div className="border border-white/20 p-6 relative bg-[#0b2f5c]/40">
              <span className={`${ibmPlexMono.className} absolute -top-2 -left-2 bg-[#0b2f5c] px-1 text-[10px] text-white/50`}>CTRL - OVERRIDES</span>
              <div className="grid grid-cols-2 gap-4 font-mono text-xs mt-2">
                <button onClick={() => resume("restaurant-accept", { accepted: true })} className="border border-white/40 p-2 hover:bg-white/10 uppercase transition-colors">Rest: Accept</button>
                <button onClick={() => resume("restaurant-accept", { accepted: false, reason: "Out of dough" })} className="border border-rose-400/50 text-rose-300 p-2 hover:bg-rose-400/10 uppercase transition-colors">Rest: Reject</button>
                <button onClick={() => resume("driver-accept", { accepted: true })} className="border border-white/40 p-2 hover:bg-white/10 uppercase transition-colors">Driver: Accept</button>
                <button onClick={() => resume("driver-accept", { accepted: false })} className="border border-rose-400/50 text-rose-300 p-2 hover:bg-rose-400/10 uppercase transition-colors">Driver: Reject</button>
                <button onClick={() => resume("delivered")} className="border border-white/40 p-2 hover:bg-white/10 uppercase col-span-2 transition-colors">Mark Delivered</button>
              </div>
            </div>
          </div>

          {/* CONFIG & EVENT LOG */}
          <div className="space-y-8 flex flex-col h-full">
            {/* SCENARIO CONFIG */}
            <div className="border border-white/20 p-6 relative bg-[#0b2f5c]/40 flex-shrink-0">
              <span className={`${ibmPlexMono.className} absolute -top-2 -left-2 bg-[#0b2f5c] px-1 text-[10px] text-white/50`}>SYS - CONFIG</span>
              <div className="space-y-5 mt-2 font-mono text-xs">
                <div>
                  <label className="text-white/50 block mb-2 uppercase">Injection Point (FailAt)</label>
                  <select value={failAt ?? "null"} onChange={e => setFailAt(e.target.value === "null" ? null : e.target.value as FailStep)} className="w-full bg-[#0b2f5c] border border-white/30 text-white p-2 outline-none cursor-pointer">
                    {FAIL_OPTIONS.map(opt => (
                      <option key={String(opt.value)} value={opt.value ?? "null"}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center w-5 h-5 border border-white/50 bg-[#0b2f5c] group-hover:border-white transition-colors">
                      <input type="checkbox" checked={autoAck} onChange={e => setAutoAck(e.target.checked)} className="peer opacity-0 absolute inset-0 cursor-pointer" />
                      <svg className="hidden peer-checked:block w-3 h-3 stroke-white fill-none stroke-2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <span className="uppercase text-white/80 group-hover:text-white transition-colors">Auto-Acknowledge Hooks</span>
                  </label>
                </div>
              </div>
            </div>

            {/* EVENT FEED */}
            <div className="border border-white/20 p-6 relative bg-[#0b2f5c]/40 flex flex-col flex-1 min-h-[400px]">
              <span className={`${ibmPlexMono.className} absolute -top-2 -left-2 bg-[#0b2f5c] px-1 text-[10px] text-white/50`}>LOG - CHANGE FEED</span>
              <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 mt-2 pr-2 blueprint-scroll absolute inset-0 top-6 bottom-4 left-6 right-4">
                {events.length === 0 ? (
                  <div className="text-white/30 pt-4">AWAITING TELEMETRY...</div>
                ) : (
                  events.map((e, i) => (
                    <div key={i} className="border-b border-white/10 pb-2 mb-2 last:border-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className={`font-semibold ${
                          e.type.includes('fail') || e.type.includes('compensat') ? 'text-rose-400' :
                          e.type.includes('success') || e.type.includes('resolve') || e.type.includes('done') ? 'text-emerald-400' :
                          e.type.includes('wait') ? 'text-amber-400' :
                          'text-sky-300'
                        }`}>[{e.type}]</span>
                        <span className="text-white/30 text-[8px]">SEQ-{String(i).padStart(4, '0')}</span>
                      </div>
                      <div className="text-white/80 break-words whitespace-pre-wrap leading-relaxed">{summarizeEvent(e)}</div>
                    </div>
                  ))
                )}
                <div ref={eventsEndRef} className="h-1" />
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

function summarizeEvent(e: OrderEvent): string {
  switch (e.type) {
    case "step_running":
    case "step_succeeded":
    case "step_failed":
    case "step_skipped":
      return `Target: ${e.label}${"detail" in e && e.detail ? ` | Detail: ${e.detail}` : ""}${"error" in e && e.error ? ` | Error: ${e.error}` : ""}`;
    case "waiting_for_hook":
      return `Halt: ${e.label}`;
    case "hook_resolved":
      return `Resumed: ${e.detail ?? e.token}`;
    case "compensation_pushed":
      return `Rollback queued: ${e.action} (src: ${e.forStep})`;
    case "compensating":
    case "compensated":
      return `Exec: ${e.action}`;
    case "log":
      return `Log: ${e.message}`;
    case "done":
      return `Terminated: ${e.status} | Ref: ${e.orderId}`;
    default:
      return "";
  }
}
