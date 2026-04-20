"use client";

import { createContext, useContext } from "react";

const SlidesDebugContext = createContext(false);

export function SlidesDebugProvider({
  value,
  children,
}: {
  value: boolean;
  children: React.ReactNode;
}) {
  return (
    <SlidesDebugContext.Provider value={value}>
      {children}
    </SlidesDebugContext.Provider>
  );
}

export function useSlidesDebug() {
  return useContext(SlidesDebugContext);
}
