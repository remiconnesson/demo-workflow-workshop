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
// Variant 25 · The sky
// Deep night sky full-bleed. 50 stars at deterministic positions twinkle via
// staggered CSS keyframes. Small green/blue meteors streak across the sky
// every few seconds (CSS transform). At the fraud frame a RED meteor appears
// top-right and streaks toward center-left, but FREEZES mid-arc. Other
// stars dim, a red halo pulses around it. Kill: meteor goes black, sky dims
// further. Replay: meteor re-ignites at frozen position (cached trajectory).
// Resume: emerald banner.
// ---------------------------------------------------------------------------

const FRAUD_IDX = CHARGES.length - 1;
const METEOR_CADENCE_MS = 800;

type Star = { x: number; y: number; size: number; delay: number; dur: number };
type Meteor = { id: number; angleDeg: number; startX: number; startY: number; color: "green" | "sky" };

// Deterministic PRNG so server and client render the same layout.
function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStars(): Star[] {
  const rnd = mulberry32(94_42_01);
  const out: Star[] = [];
  for (let i = 0; i < 54; i++) {
    out.push({
      x: rnd() * 100,
      y: rnd() * 100,
      size: 0.8 + rnd() * 2.4,
      delay: rnd() * 4,
      dur: 2.5 + rnd() * 3.5,
    });
  }
  return out;
}

function buildMeteors(): Meteor[] {
  const rnd = mulberry32(42_13_04);
  const list: Meteor[] = [];
  // 9 ambient meteors, one per non-fraud charge
  for (let i = 0; i < FRAUD_IDX; i++) {
    list.push({
      id: i,
      angleDeg: 18 + rnd() * 22, // down-left diagonals
      startX: 20 + rnd() * 70,
      startY: -5 - rnd() * 10,
      color: rnd() > 0.5 ? "green" : "sky",
    });
  }
  return list;
}

export function SkyDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 7_500,
    crashHoldMs: 2_400,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  const stars = useMemo(() => buildStars(), []);
  const meteors = useMemo(() => buildMeteors(), []);

  const rawTicks = Math.floor(elapsed / METEOR_CADENCE_MS);
  const locked = m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;
  const ticks = locked ? FRAUD_IDX + 1 : Math.min(rawTicks, FRAUD_IDX + 1);
  const atFraud = ticks >= FRAUD_IDX;

  const scanned = 42_804_192 + Math.min(ticks, CHARGES.length) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "watch(sky: 94 nights)" });
    out.push({ kind: "RUN", msg: `track(meteor: ${Math.min(ticks, FRAUD_IDX)})` });
    if (atFraud) {
      out.push({ kind: "CMP", msg: `assess(${FRAUD_CARD}: crimson arc)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed) out.push({ kind: "ERR", msg: "sky dark · observer down" });
    if (m.isReplaying) out.push({ kind: "RPL", msg: "re-igniting arc · cached" });
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, ticks, atFraud, m.isCrashed, m.isReplaying, m.isResumed]);

  // Sky dim multiplier: 1 is full brightness; 0.25 after crash.
  const skyBright = m.isCrashed ? 0.25 : atFraud ? 0.6 : 1;
  const redMeteorLit = atFraud && !m.isCrashed;

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="The sky · night 94"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10"
        style={{
          background:
            "radial-gradient(ellipse at 50% 120%, rgba(10,14,40,0.7) 0%, rgba(4,6,20,1) 40%, rgba(0,0,1,1) 100%)",
        }}
      >
        {/* scope labels */}
        <div className="pointer-events-none absolute top-6 left-8 z-10 flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            observer · bearing
          </span>
          <span
            className={`font-mono text-3xl tabular-nums transition-colors duration-300 ${
              atFraud ? "text-red-300" : "text-sky-300"
            }`}
          >
            {atFraud ? "ARC FROZEN · 0.93" : `${70 + (ticks % 6)} NE`}
          </span>
        </div>
        <div className="pointer-events-none absolute top-6 right-8 z-10 flex flex-col items-end gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            nights watched
          </span>
          <span className="font-mono text-3xl tabular-nums text-zinc-200">94</span>
        </div>

        {/* stars layer */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-700"
          style={{ opacity: skyBright }}
        >
          {stars.map((s, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                filter: `blur(${s.size > 2 ? 0.6 : 0.3}px)`,
                opacity: 0.6,
                animation: `skyTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
              }}
            />
          ))}
        </div>

        {/* ambient meteors */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-500"
          style={{ opacity: m.isCrashed ? 0 : atFraud ? 0.3 : 1 }}
        >
          {meteors.map((mt, i) => (
            <Meteor
              key={mt.id}
              meteor={mt}
              index={i}
              active={m.active}
            />
          ))}
        </div>

        {/* RED meteor, pre-positioned and frozen at fraud */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-500"
          style={{ opacity: atFraud ? 1 : 0 }}
        >
          <RedMeteor lit={redMeteorLit} replaying={m.isReplaying} />
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Sky dark · observer down"
          footer="Event log intact · arc cached"
        />
        <ReplayingChip active={m.isReplaying} />
        <IdleHint
          eyebrow="fraud sentinel · always on"
          purpose="94 nights watching the sky."
          active={!m.active}
        />

        <style>{`
          @keyframes skyTwinkle {
            0%, 100% { opacity: 0.2; transform: scale(0.9); }
            50%      { opacity: 1; transform: scale(1.1); }
          }
        `}</style>
      </div>

      <ResumedBanner
        active={m.isResumed}
        headline="94 nights watched · 1 meteor caught mid-fall."
        stat={`${FRAUD_CARD} · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meteor: streaks on a staggered loop via CSS keyframes. Uses the angle
// and start position from the precomputed data.
// ---------------------------------------------------------------------------

function Meteor({
  meteor,
  index,
  active,
}: {
  meteor: Meteor;
  index: number;
  active: boolean;
}) {
  const color = meteor.color === "green" ? "rgb(74,222,128)" : "rgb(125,211,252)";
  const shadow = meteor.color === "green"
    ? "drop-shadow(0 0 4px rgba(74,222,128,0.8))"
    : "drop-shadow(0 0 4px rgba(125,211,252,0.8))";
  const delay = (index % 6) * 1.3;
  const dur = 4 + (index % 3);
  return (
    <div
      className="absolute"
      style={{
        left: `${meteor.startX}%`,
        top: `${meteor.startY}%`,
        transform: `rotate(${meteor.angleDeg}deg)`,
        transformOrigin: "0 0",
        opacity: active ? 1 : 0,
        animation: active ? `skyMeteor ${dur}s linear ${delay}s infinite` : undefined,
      }}
    >
      <div
        className="rounded-full"
        style={{
          width: "90px",
          height: "2px",
          background: `linear-gradient(90deg, rgba(255,255,255,0) 0%, ${color} 80%, white 100%)`,
          filter: shadow,
        }}
      />
      <style>{`
        @keyframes skyMeteor {
          0%    { transform: translate(-10%, -20%); opacity: 0; }
          10%   { opacity: 1; }
          85%   { opacity: 1; }
          100%  { transform: translate(120%, 180%); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RedMeteor: frozen mid-arc using animation-play-state: paused via a CSS
// keyframe that never advances. Crimson tail trailing behind.
// ---------------------------------------------------------------------------

function RedMeteor({ lit, replaying }: { lit: boolean; replaying: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* halo pulse around frozen meteor */}
      <div
        className="absolute"
        style={{
          left: "42%",
          top: "46%",
          width: "260px",
          height: "260px",
          marginLeft: "-130px",
          marginTop: "-130px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(248,113,113,0.35) 0%, rgba(248,113,113,0.12) 40%, rgba(248,113,113,0) 70%)",
          animation: lit ? "skyHaloPulse 1.8s ease-in-out infinite" : undefined,
          opacity: lit ? 1 : 0.2,
          transition: "opacity 400ms ease",
          filter: replaying ? "brightness(1.4) saturate(1.2)" : "none",
        }}
      />

      {/* meteor body + tail, frozen at 42%/46% */}
      <div
        className="absolute"
        style={{
          left: "42%",
          top: "46%",
          transform: "rotate(32deg)",
          transformOrigin: "100% 50%",
        }}
      >
        {/* tail */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "-3px",
            width: "320px",
            height: "6px",
            background:
              "linear-gradient(90deg, rgba(220,38,38,0) 0%, rgba(220,38,38,0.55) 55%, rgba(248,113,113,0.95) 92%, rgb(255,255,255) 100%)",
            filter: lit
              ? "drop-shadow(0 0 6px rgba(248,113,113,0.95))"
              : "drop-shadow(0 0 3px rgba(127,29,29,0.6))",
            opacity: lit ? 1 : 0.35,
            transition: "opacity 400ms ease",
          }}
        />
        {/* head */}
        <div
          style={{
            position: "absolute",
            right: "-6px",
            top: "-6px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: lit ? "radial-gradient(circle, white 0%, rgb(248,113,113) 50%, rgb(127,29,29) 100%)" : "rgb(20,6,6)",
            boxShadow: lit ? "0 0 20px rgba(248,113,113,1), 0 0 40px rgba(248,113,113,0.6)" : "none",
            transition: "background 400ms ease, box-shadow 400ms ease",
          }}
        />
      </div>

      {/* FROZEN label */}
      <div
        className="absolute"
        style={{
          left: "42%",
          top: "52%",
          transform: "translateX(-40%)",
        }}
      >
        <span
          className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-red-300"
          style={{
            textShadow: "0 0 10px rgba(248,113,113,0.6)",
            opacity: lit ? 1 : 0.5,
            transition: "opacity 400ms ease",
          }}
        >
          frozen mid-arc
        </span>
      </div>

      <style>{`
        @keyframes skyHaloPulse {
          0%, 100% { transform: scale(0.9); opacity: 0.6; }
          50%      { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
