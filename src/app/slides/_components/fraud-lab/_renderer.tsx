"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

const FRAUD_VARIANT_COMPONENTS: Record<string, ComponentType> = {
  heartbeat:  dynamic(() => import("./variant-01-heartbeat").then((m) => ({ default: m.HeartbeatDemo })),  { ssr: false }),
  choir:      dynamic(() => import("./variant-02-choir").then((m) => ({ default: m.ChoirDemo })),          { ssr: false }),
  tape:       dynamic(() => import("./variant-03-tape").then((m) => ({ default: m.TapeDemo })),            { ssr: false }),
  giant:      dynamic(() => import("./variant-04-giant").then((m) => ({ default: m.GiantDemo })),          { ssr: false }),
  conveyor:   dynamic(() => import("./variant-05-conveyor").then((m) => ({ default: m.ConveyorDemo })),    { ssr: false }),
  telescope:  dynamic(() => import("./variant-06-telescope").then((m) => ({ default: m.TelescopeDemo })),  { ssr: false }),
  courtroom:  dynamic(() => import("./variant-07-courtroom").then((m) => ({ default: m.CourtroomDemo })),  { ssr: false }),
  hive:       dynamic(() => import("./variant-08-hive").then((m) => ({ default: m.HiveDemo })),            { ssr: false }),
  "reading-ai": dynamic(() => import("./variant-09-reading-ai").then((m) => ({ default: m.ReadingAiDemo })), { ssr: false }),
  galaxy:     dynamic(() => import("./variant-10-galaxy").then((m) => ({ default: m.GalaxyDemo })),        { ssr: false }),
  radar:      dynamic(() => import("./variant-11-radar").then((m) => ({ default: m.RadarDemo })),          { ssr: false }),
  slot:       dynamic(() => import("./variant-12-slot").then((m) => ({ default: m.SlotDemo })),            { ssr: false }),
  scroll:     dynamic(() => import("./variant-13-scroll").then((m) => ({ default: m.ScrollDemo })),        { ssr: false }),
  brain:      dynamic(() => import("./variant-14-brain").then((m) => ({ default: m.BrainDemo })),          { ssr: false }),
  eyes:       dynamic(() => import("./variant-15-eyes").then((m) => ({ default: m.EyesDemo })),            { ssr: false }),
  metronome:  dynamic(() => import("./variant-16-metronome").then((m) => ({ default: m.MetronomeDemo })),  { ssr: false }),
  loom:       dynamic(() => import("./variant-17-loom").then((m) => ({ default: m.LoomDemo })),            { ssr: false }),
  guardian:   dynamic(() => import("./variant-18-guardian").then((m) => ({ default: m.GuardianDemo })),    { ssr: false }),
  lighthouse: dynamic(() => import("./variant-19-lighthouse").then((m) => ({ default: m.LighthouseDemo })), { ssr: false }),
  aquarium:   dynamic(() => import("./variant-20-aquarium").then((m) => ({ default: m.AquariumDemo })),    { ssr: false }),
  "card-duel": dynamic(() => import("./variant-21-card-duel").then((m) => ({ default: m.CardDuelDemo })),   { ssr: false }),
  elevator:   dynamic(() => import("./variant-22-elevator").then((m) => ({ default: m.ElevatorDemo })),    { ssr: false }),
  satellite:  dynamic(() => import("./variant-23-satellite").then((m) => ({ default: m.SatelliteDemo })),  { ssr: false }),
  book:       dynamic(() => import("./variant-24-book").then((m) => ({ default: m.BookDemo })),            { ssr: false }),
  sky:        dynamic(() => import("./variant-25-sky").then((m) => ({ default: m.SkyDemo })),              { ssr: false }),
};

export function FraudVariantRenderer({ slug }: { slug: string }) {
  const Component = FRAUD_VARIANT_COMPONENTS[slug];
  if (!Component) return null;
  return <Component />;
}
