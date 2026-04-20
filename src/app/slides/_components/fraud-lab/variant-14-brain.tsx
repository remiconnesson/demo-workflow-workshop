"use client";

import { useMemo } from "react";
import { AgentDebugDrawer, type DebugEvent } from "../agent-debug-drawer";
import {
  CHARGES,
  FRAUD_CARD,
  FRAUD_MERCHANT,
  FRAUD_REASON,
  STARTING_LOOP,
  TopStrip,
  IdleHint,
  CrashOverlay,
  ReplayingChip,
  ResumedBanner,
  KillButton,
  usePhaseMachine,
  useElapsed,
} from "./_shared";

// ---------------------------------------------------------------------------
// Variant 14 · Brain scan (fMRI)
// Central sagittal brain outline with 5 labeled factor regions. Each charge
// causes the 4 "normal" factor regions to bloom softly in unison. On fraud,
// ALL 4 fire at once AND a new region — ANOMALY_LOCALIZATION — activates for
// the first time in 94 days. The whole brain pulses red once. A motor cortex
// dot lights up labeled "MOTOR: freeze account". Crash dims all but the outline.
// Replay fast-forwards activations; resume keeps the frozen pattern lit.
// ---------------------------------------------------------------------------

const BLOOM_PERIOD_MS = 1_600;

type Region = {
  id: string;
  label: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotate: number;
  color: string;
  normal: boolean; // part of the everyday 4
};

const REGIONS: Region[] = [
  {
    id: "merchant",
    label: "MERCHANT_FAMILIARITY",
    cx: 180,
    cy: 110,
    rx: 42,
    ry: 26,
    rotate: -10,
    color: "rgb(56,189,248)",
    normal: true,
  },
  {
    id: "geo",
    label: "GEO",
    cx: 250,
    cy: 100,
    rx: 34,
    ry: 22,
    rotate: 12,
    color: "rgb(52,211,153)",
    normal: true,
  },
  {
    id: "velocity",
    label: "VELOCITY",
    cx: 300,
    cy: 150,
    rx: 30,
    ry: 22,
    rotate: 8,
    color: "rgb(168,85,247)",
    normal: true,
  },
  {
    id: "amount",
    label: "AMOUNT_RATIO",
    cx: 210,
    cy: 180,
    rx: 38,
    ry: 22,
    rotate: -4,
    color: "rgb(251,191,36)",
    normal: true,
  },
  {
    id: "history",
    label: "HISTORY",
    cx: 140,
    cy: 160,
    rx: 30,
    ry: 20,
    rotate: 6,
    color: "rgb(244,114,182)",
    normal: true,
  },
  {
    id: "anomaly",
    label: "ANOMALY_LOCALIZATION",
    cx: 230,
    cy: 140,
    rx: 26,
    ry: 18,
    rotate: 0,
    color: "rgb(248,113,113)",
    normal: false,
  },
];

export function BrainDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 8_000,
    crashHoldMs: 2_200,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  const bloomT = (elapsed % BLOOM_PERIOD_MS) / BLOOM_PERIOD_MS;
  const bloomIntensity = Math.sin(bloomT * Math.PI); // 0..1..0

  const ticks = Math.floor(elapsed / BLOOM_PERIOD_MS);
  const scanned = 42_804_192 + Math.min(ticks, CHARGES.length) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  const fraudFired = m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;
  const brainDark = m.isCrashed;

  // Replay cascade — ramps through the 4 normal regions quickly then fixes.
  const replayProgress = m.isReplaying
    ? Math.min(1, (elapsed % 1800) / 1500)
    : 0;

  const currentCharge = CHARGES[Math.min(ticks, CHARGES.length - 1)];

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "scanCharges(window: 60s)" });
    out.push({ kind: "RUN", msg: `fMRI.bloom(factors: 4)` });
    if (fraudFired) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: 0.93)` });
      out.push({ kind: "CMP", msg: "anomaly_localization · first fire" });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed || m.isReplaying || m.isResumed) {
      out.push({ kind: "ERR", msg: "EEG isolated · process killed" });
    }
    if (m.isReplaying || m.isResumed) {
      out.push({ kind: "RPL", msg: "replaying activations" });
    }
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, fraudFired, m.isCrashed, m.isReplaying, m.isResumed]);

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Brain · fMRI"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black">
        {/* Corner readout */}
        <div className="pointer-events-none absolute top-6 left-8 flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            fMRI · sagittal
          </span>
          <span
            className={`font-mono text-xl tabular-nums transition-colors duration-300 ${
              brainDark ? "text-red-300" : "text-zinc-200"
            }`}
          >
            94d SCAN
          </span>
        </div>
        <div className="pointer-events-none absolute top-6 right-8 flex flex-col items-end gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            subject
          </span>
          <span
            className={`font-mono text-xl tabular-nums transition-colors duration-300 ${
              fraudFired ? "text-red-300" : "text-zinc-300"
            }`}
          >
            {fraudFired ? FRAUD_CARD : currentCharge.card}
          </span>
        </div>

        {/* Brain + readouts */}
        <div className="absolute inset-0 flex items-center justify-center gap-10 px-10">
          {/* Brain SVG */}
          <svg
            viewBox="0 0 440 300"
            className={`h-[min(78%,560px)] w-[min(78%,800px)] transition-opacity duration-500 ${
              brainDark ? "opacity-30" : "opacity-100"
            }`}
          >
            <defs>
              {REGIONS.map((r) => (
                <radialGradient key={`g-${r.id}`} id={`brain-${r.id}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={r.color} stopOpacity="0.95" />
                  <stop offset="70%" stopColor={r.color} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={r.color} stopOpacity="0" />
                </radialGradient>
              ))}
              <filter id="brain-glow">
                <feGaussianBlur stdDeviation="3" />
              </filter>
            </defs>

            {/* Red pulse over whole brain on fraud */}
            {fraudFired && (
              <ellipse
                cx="220"
                cy="150"
                rx="175"
                ry="115"
                fill="rgba(248,113,113,0.08)"
                style={{
                  filter: "drop-shadow(0 0 20px rgba(248,113,113,0.35))",
                }}
              >
                <animate attributeName="rx" from="165" to="185" dur="1.2s" repeatCount="1" />
              </ellipse>
            )}

            {/* Sagittal brain outline (stylized) */}
            <path
              d="M 60 150
                 C 60 80, 140 40, 220 44
                 C 310 44, 380 90, 388 150
                 C 390 200, 360 240, 300 258
                 C 270 268, 250 260, 240 250
                 C 230 258, 220 266, 202 262
                 L 196 278
                 L 184 266
                 C 150 268, 120 260, 100 246
                 C 70 226, 55 200, 60 170
                 Z"
              fill="none"
              stroke={brainDark ? "rgba(161,161,170,0.6)" : "white"}
              strokeWidth="1.8"
              strokeOpacity="0.8"
              style={{
                filter: "drop-shadow(0 0 6px rgba(255,255,255,0.15))",
              }}
            />

            {/* Sulci / cortex folds — decorative lines */}
            {[
              "M 90 110 C 130 120, 170 108, 200 115",
              "M 120 80 C 150 90, 190 80, 230 90",
              "M 200 60 C 240 62, 290 68, 340 90",
              "M 90 180 C 140 186, 190 184, 240 190",
              "M 130 220 C 180 218, 240 226, 290 222",
              "M 300 110 C 320 130, 330 150, 320 180",
              "M 260 70 C 290 85, 330 100, 360 130",
            ].map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="white"
                strokeOpacity={brainDark ? 0.08 : 0.18}
                strokeWidth="0.9"
              />
            ))}

            {/* Brainstem stub */}
            <path
              d="M 220 258 C 218 278, 226 284, 236 284"
              fill="none"
              stroke={brainDark ? "rgba(161,161,170,0.5)" : "white"}
              strokeWidth="1.6"
              strokeOpacity="0.65"
            />

            {/* Factor regions */}
            {REGIONS.map((r, i) => {
              let intensity = 0;
              if (r.normal) {
                if (fraudFired) {
                  intensity = 1; // all four fire
                } else if (m.isReplaying) {
                  intensity = replayProgress > i / 5 ? 0.9 : 0.2;
                } else {
                  intensity = 0.25 + bloomIntensity * 0.65;
                }
              } else {
                // Anomaly region only fires on fraud
                intensity = fraudFired ? 1 : 0;
              }

              if (brainDark) intensity *= 0.4;

              return (
                <g key={r.id}>
                  <ellipse
                    cx={r.cx}
                    cy={r.cy}
                    rx={r.rx}
                    ry={r.ry}
                    transform={`rotate(${r.rotate} ${r.cx} ${r.cy})`}
                    fill={`url(#brain-${r.id})`}
                    opacity={intensity}
                    style={{ transition: "opacity 350ms ease" }}
                  />
                </g>
              );
            })}

            {/* Motor cortex dot — lights on fraud only */}
            <g
              opacity={fraudFired ? 1 : 0}
              style={{ transition: "opacity 400ms ease 240ms" }}
            >
              <circle
                cx={220}
                cy={58}
                r={8}
                fill="rgb(248,113,113)"
                style={{ filter: "drop-shadow(0 0 8px rgba(248,113,113,0.9))" }}
              >
                <animate attributeName="r" from="6" to="10" dur="1.2s" repeatCount="indefinite" />
              </circle>
              <line
                x1={220}
                y1={58}
                x2={350}
                y2={42}
                stroke="rgb(248,113,113)"
                strokeOpacity="0.5"
                strokeDasharray="2 2"
                strokeWidth="0.8"
              />
              <text
                x={354}
                y={42}
                fontSize="10"
                fontFamily="ui-monospace, monospace"
                fill="rgb(248,113,113)"
              >
                MOTOR: freeze
              </text>
            </g>

            {/* Region labels with connector lines */}
            {REGIONS.map((r) => {
              const active = r.normal ? true : fraudFired;
              const lx = r.cx > 220 ? r.cx + r.rx + 20 : r.cx - r.rx - 20;
              const ly = r.cy;
              const anchor = r.cx > 220 ? "start" : "end";
              return (
                <g
                  key={`lbl-${r.id}`}
                  opacity={active ? 0.85 : 0.3}
                  style={{ transition: "opacity 400ms ease" }}
                >
                  <text
                    x={lx}
                    y={ly}
                    fontSize="8"
                    fontFamily="ui-monospace, monospace"
                    fill={r.normal ? "rgba(226,232,240,0.85)" : "rgb(248,113,113)"}
                    textAnchor={anchor}
                  >
                    {r.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Side readout */}
          <div className="flex w-[260px] flex-col gap-5">
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                readout
              </span>
              <div
                className={`mt-2 font-mono text-3xl tabular-nums transition-colors duration-300 ${
                  fraudFired ? "text-red-300" : "text-emerald-300"
                }`}
              >
                {fraudFired ? "5/5" : "4/4"}
                <span className="text-xl text-zinc-500"> flags</span>
              </div>
              <div
                className={`mt-1 font-mono text-sm transition-colors duration-300 ${
                  fraudFired ? "text-red-300" : "text-zinc-400"
                }`}
              >
                confidence {fraudFired ? "0.93" : "0.07"}
              </div>
              <div
                className={`mt-3 rounded-md border px-3 py-2 font-mono text-xs uppercase tracking-[0.2em] transition-all duration-300 ${
                  fraudFired
                    ? "border-red-500/60 bg-red-500/10 text-red-300"
                    : "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                }`}
              >
                {fraudFired ? "acting · freeze" : "monitoring"}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                novel region
              </span>
              <div
                className={`mt-2 font-mono text-xl transition-colors duration-300 ${
                  fraudFired ? "text-red-200" : "text-zinc-500"
                }`}
              >
                {fraudFired
                  ? "ANOMALY_LOCALIZATION"
                  : "— never activated —"}
              </div>
              <div className="mt-1 font-mono text-xs text-zinc-500">
                94d / first fire {fraudFired ? "now" : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* EEG isolated chip */}
        <div
          className={`pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${
            m.isCrashed ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="rounded-full border border-red-500/60 bg-black/80 px-5 py-2 font-mono text-sm uppercase tracking-[0.3em] text-red-300">
            patient stable · EEG isolated
          </span>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Scan paused · process killed"
          footer="Event log intact · activations cached"
        />
        <ReplayingChip active={m.isReplaying} />
        <IdleHint
          eyebrow="fraud sentinel · always on"
          purpose="94 days of one loop."
          active={!m.active}
        />
      </div>

      <ResumedBanner
        active={m.isResumed}
        headline="Crash survived."
        stat={`${FRAUD_CARD} frozen · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}
