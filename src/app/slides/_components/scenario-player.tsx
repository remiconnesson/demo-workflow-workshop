"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export type ScenarioFrame<T> = {
  id: string;
  atMs: number;
  data: T;
};

export function ScenarioPlayer<T>({
  slide,
  scenarioId,
  frames,
  autoPlay = false,
  children,
}: {
  slide: string;
  scenarioId: string;
  frames: ScenarioFrame<T>[];
  autoPlay?: boolean;
  children: (state: {
    current: T;
    index: number;
    playing: boolean;
    play: () => void;
    pause: () => void;
    reset: () => void;
    next: () => void;
    prev: () => void;
  }) => ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    console.info("[slide-lab] ready", {
      slide,
      scenarioId,
      frames: frames.length,
    });
  }, [slide, scenarioId, frames.length]);

  useEffect(() => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];

    if (!playing || frames.length === 0) return;

    const baseAt = frames[index]?.atMs ?? 0;
    for (let i = index + 1; i < frames.length; i++) {
      const timer = window.setTimeout(() => {
        console.info("[slide-lab] frame", {
          slide,
          scenarioId,
          frame: frames[i].id,
          index: i,
        });
        setIndex(i);
        if (i === frames.length - 1) {
          setPlaying(false);
        }
      }, Math.max(0, frames[i].atMs - baseAt));
      timersRef.current.push(timer);
    }

    return () => {
      timersRef.current.forEach(window.clearTimeout);
      timersRef.current = [];
    };
  }, [frames, index, playing, scenarioId, slide]);

  if (frames.length === 0) return null;

  const play = () => {
    console.info("[slide-lab] play", { slide, scenarioId, index });
    setPlaying(true);
  };

  const pause = () => {
    console.info("[slide-lab] pause", { slide, scenarioId, index });
    setPlaying(false);
  };

  const reset = () => {
    console.info("[slide-lab] reset", { slide, scenarioId });
    setPlaying(false);
    setIndex(0);
  };

  const next = () => {
    setPlaying(false);
    setIndex((value) => {
      const nextValue = Math.min(frames.length - 1, value + 1);
      console.info("[slide-lab] next", {
        slide,
        scenarioId,
        index: nextValue,
      });
      return nextValue;
    });
  };

  const prev = () => {
    setPlaying(false);
    setIndex((value) => {
      const nextValue = Math.max(0, value - 1);
      console.info("[slide-lab] prev", {
        slide,
        scenarioId,
        index: nextValue,
      });
      return nextValue;
    });
  };

  return (
    <>
      {children({
        current: frames[index].data,
        index,
        playing,
        play,
        pause,
        reset,
        next,
        prev,
      })}
    </>
  );
}
