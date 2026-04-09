import type { ReactNode } from "react";

export function Kw({ children }: { children: ReactNode }) {
  return <span className="text-sky-300">{children}</span>;
}

export function Dir({ children }: { children: ReactNode }) {
  return <span className="text-emerald-400 font-semibold">{children}</span>;
}

export function Fn({ children }: { children: ReactNode }) {
  return <span className="text-white font-semibold">{children}</span>;
}

export function Str({ children }: { children: ReactNode }) {
  return <span className="text-amber-300">{children}</span>;
}

export function Cmt({ children }: { children: ReactNode }) {
  return <span className="text-zinc-500 italic">{children}</span>;
}

export function Typ({ children }: { children: ReactNode }) {
  return <span className="text-fuchsia-300">{children}</span>;
}

export function Punc({ children }: { children: ReactNode }) {
  return <span className="text-zinc-500">{children}</span>;
}
