import { CodeBlock } from "./code-block";
import { PLACE_ORDER_DURABLE, type SpotlightLine } from "./place-order-code";

export type CloserPrimitive =
  | "step"
  | "idempotency"
  | "hook"
  | "sleep-race"
  | "compensation"
  | "replay";

type CloserRecapSlideProps = {
  primitive: CloserPrimitive;
  title: string;
  lineNumber: SpotlightLine;
  setupWorry: string;
  description: string;
  sdkExplanation?: string;
};

type VerbFamily = "retry" | "suspend" | "rollback";

type CloserProgressTone = "sky" | "amber" | "fuchsia";

type CloserProgressItem = {
  primitive: CloserPrimitive;
  label: string;
  tone: CloserProgressTone;
};

const CLOSER_PROGRESS: CloserProgressItem[] = [
  { primitive: "step", label: "Step", tone: "sky" },
  { primitive: "idempotency", label: "Idempotency", tone: "sky" },
  { primitive: "hook", label: "Hook", tone: "amber" },
  { primitive: "sleep-race", label: "Sleep + Race", tone: "amber" },
  { primitive: "compensation", label: "Compensation", tone: "fuchsia" },
  { primitive: "replay", label: "Replay", tone: "sky" },
];

const PROGRESS_TONE_CLASS: Record<
  CloserProgressTone,
  {
    dot: string;
    line: string;
    text: string;
    glow: string;
  }
> = {
  sky: {
    dot: "bg-sky-400",
    line: "bg-sky-400",
    text: "text-sky-300",
    glow: "shadow-[0_0_22px_rgba(56,189,248,0.55)]",
  },
  amber: {
    dot: "bg-amber-400",
    line: "bg-amber-400",
    text: "text-amber-300",
    glow: "shadow-[0_0_22px_rgba(251,191,36,0.55)]",
  },
  fuchsia: {
    dot: "bg-fuchsia-400",
    line: "bg-fuchsia-400",
    text: "text-fuchsia-300",
    glow: "shadow-[0_0_22px_rgba(232,121,249,0.55)]",
  },
};

function CloserProgressFooter({
  primitive,
}: {
  primitive: CloserPrimitive;
}) {
  const activeIndex = Math.max(
    0,
    CLOSER_PROGRESS.findIndex((item) => item.primitive === primitive),
  );
  const activeItem = CLOSER_PROGRESS[activeIndex] ?? CLOSER_PROGRESS[0];
  const activeTone = PROGRESS_TONE_CLASS[activeItem.tone];

  return (
    <footer className="col-span-2 flex justify-center">
      <div className="flex items-center gap-5 rounded-full border border-white/10 bg-zinc-950/75 px-6 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.32)]">
        <span className="whitespace-nowrap font-mono text-sm font-semibold uppercase tracking-[0.22em] text-zinc-600">
          Original function
        </span>
        <div aria-hidden className="flex items-center gap-2">
          {CLOSER_PROGRESS.map((item, index) => {
            const tone = PROGRESS_TONE_CLASS[item.tone];
            const isPast = index < activeIndex;
            const isCurrent = index === activeIndex;
            const isReached = index <= activeIndex;
            return (
              <div key={item.primitive} className="flex items-center gap-2">
                <span
                  className={`block rounded-full transition-all duration-300 ${
                    isCurrent
                      ? `h-4 w-14 ${tone.dot} ${tone.glow}`
                      : isReached
                        ? `h-3.5 w-3.5 ${tone.dot}`
                        : "h-3.5 w-3.5 bg-white/10"
                  }`}
                />
                {index < CLOSER_PROGRESS.length - 1 ? (
                  <span
                    className={`h-px w-8 transition-colors duration-300 ${
                      isPast ? tone.line : "bg-white/10"
                    }`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
        <span
          className={`whitespace-nowrap font-mono text-base font-semibold uppercase tracking-[0.18em] ${activeTone.text}`}
        >
          {activeIndex + 1} / 6 · {activeItem.label}
        </span>
      </div>
    </footer>
  );
}

const PRIMITIVE_FAMILY: Record<CloserPrimitive, VerbFamily> = {
  step: "retry",
  idempotency: "retry",
  replay: "retry",
  hook: "suspend",
  "sleep-race": "suspend",
  compensation: "rollback",
};

const HIGHLIGHT_LINES: Record<number, string> = {
  5: "",
  7: "",
  9: "",
  11: "",
  13: "",
  15: "",
};

const SDK_EXPLANATION: Record<CloserPrimitive, string> = {
  step: "The SDK records this step boundary, so a retry reuses the completed result instead of replaying side effects.",
  idempotency: "getStepMetadata().stepId becomes the external dedupe key for the charge.",
  hook: "A hook suspends the workflow and resumes it with the restaurant's decision.",
  "sleep-race": "sleep() is durable; Promise.race turns no driver into a clean timeout path.",
  compensation: "Throwing from a later step walks the compensation stack backward.",
  replay: "The event log lets the run restart after a crash and continue from the last completed step.",
};

const ASIDE_CLASS_BY_FAMILY: Record<VerbFamily, string> = {
  retry:
    "border-sky-400/20 bg-sky-500/[0.03] shadow-[0_0_72px_rgba(56,189,248,0.08)]",
  suspend:
    "border-amber-400/25 bg-amber-500/[0.03] shadow-[0_0_72px_rgba(251,191,36,0.08)]",
  rollback:
    "border-fuchsia-400/25 bg-fuchsia-500/[0.03] shadow-[0_0_72px_rgba(232,121,249,0.08)]",
};

const TITLE_CLASS_BY_FAMILY: Record<VerbFamily, string> = {
  retry: "text-sky-300",
  suspend: "text-amber-300",
  rollback: "text-fuchsia-300",
};

const LABEL_CLASS_BY_FAMILY: Record<VerbFamily, string> = {
  retry: "text-sky-400/70",
  suspend: "text-amber-400/75",
  rollback: "text-fuchsia-400/75",
};

const RECAP_CODE_BASE_CLASS = [
  "[&_.code-hl]:!bg-transparent",
  "[&_.code-hl]:!border-l-transparent",
  "[&_.code-hl]:!ring-0",
  "[&_.code-hl]:!shadow-none",
  "[&_.code-hl]:transition-all",
  "[&_.code-hl]:duration-300",
  "[&_.code-hl:hover]:!bg-transparent",
  "[&_.code-hl:hover]:!border-l-transparent",
  "[&_.code-hl:hover]:!shadow-none",
].join(" ");

type SpotlightKey = `${VerbFamily}-${SpotlightLine}`;

const SPOTLIGHT_CLASS_BY_KEY: Record<SpotlightKey, string> = {
  // ── retry family (sky) ────────────────────────────────────────────
  "retry-5": [
    "[&_.code-hl:not(.code-line-5)]:opacity-25",
    "[&_.code-line-5.code-hl]:!opacity-100",
    "[&_.code-line-5.code-hl]:!bg-sky-500/10",
    "[&_.code-line-5.code-hl]:!border-l-sky-300",
    "[&_.code-line-5.code-hl]:!ring-2",
    "[&_.code-line-5.code-hl]:!ring-sky-400/45",
    "[&_.code-line-5.code-hl]:!shadow-[0_0_46px_rgba(56,189,248,0.28),inset_0_0_0_1px_rgba(56,189,248,0.35)]",
  ].join(" "),
  "retry-7": [
    "[&_.code-hl:not(.code-line-7)]:opacity-25",
    "[&_.code-line-7.code-hl]:!opacity-100",
    "[&_.code-line-7.code-hl]:!bg-sky-500/10",
    "[&_.code-line-7.code-hl]:!border-l-sky-300",
    "[&_.code-line-7.code-hl]:!ring-2",
    "[&_.code-line-7.code-hl]:!ring-sky-400/45",
    "[&_.code-line-7.code-hl]:!shadow-[0_0_46px_rgba(56,189,248,0.28),inset_0_0_0_1px_rgba(56,189,248,0.35)]",
  ].join(" "),
  "retry-9": [
    "[&_.code-hl:not(.code-line-9)]:opacity-25",
    "[&_.code-line-9.code-hl]:!opacity-100",
    "[&_.code-line-9.code-hl]:!bg-sky-500/10",
    "[&_.code-line-9.code-hl]:!border-l-sky-300",
    "[&_.code-line-9.code-hl]:!ring-2",
    "[&_.code-line-9.code-hl]:!ring-sky-400/45",
    "[&_.code-line-9.code-hl]:!shadow-[0_0_46px_rgba(56,189,248,0.28),inset_0_0_0_1px_rgba(56,189,248,0.35)]",
  ].join(" "),
  "retry-11": [
    "[&_.code-hl:not(.code-line-11)]:opacity-25",
    "[&_.code-line-11.code-hl]:!opacity-100",
    "[&_.code-line-11.code-hl]:!bg-sky-500/10",
    "[&_.code-line-11.code-hl]:!border-l-sky-300",
    "[&_.code-line-11.code-hl]:!ring-2",
    "[&_.code-line-11.code-hl]:!ring-sky-400/45",
    "[&_.code-line-11.code-hl]:!shadow-[0_0_46px_rgba(56,189,248,0.28),inset_0_0_0_1px_rgba(56,189,248,0.35)]",
  ].join(" "),
  "retry-13": [
    "[&_.code-hl:not(.code-line-13)]:opacity-25",
    "[&_.code-line-13.code-hl]:!opacity-100",
    "[&_.code-line-13.code-hl]:!bg-sky-500/10",
    "[&_.code-line-13.code-hl]:!border-l-sky-300",
    "[&_.code-line-13.code-hl]:!ring-2",
    "[&_.code-line-13.code-hl]:!ring-sky-400/45",
    "[&_.code-line-13.code-hl]:!shadow-[0_0_46px_rgba(56,189,248,0.28),inset_0_0_0_1px_rgba(56,189,248,0.35)]",
  ].join(" "),
  "retry-15": [
    "[&_.code-hl:not(.code-line-15)]:opacity-25",
    "[&_.code-line-15.code-hl]:!opacity-100",
    "[&_.code-line-15.code-hl]:!bg-sky-500/10",
    "[&_.code-line-15.code-hl]:!border-l-sky-300",
    "[&_.code-line-15.code-hl]:!ring-2",
    "[&_.code-line-15.code-hl]:!ring-sky-400/45",
    "[&_.code-line-15.code-hl]:!shadow-[0_0_46px_rgba(56,189,248,0.28),inset_0_0_0_1px_rgba(56,189,248,0.35)]",
  ].join(" "),
  // ── suspend family (amber) ────────────────────────────────────────
  "suspend-5": [
    "[&_.code-hl:not(.code-line-5)]:opacity-25",
    "[&_.code-line-5.code-hl]:!opacity-100",
    "[&_.code-line-5.code-hl]:!bg-amber-500/10",
    "[&_.code-line-5.code-hl]:!border-l-amber-300",
    "[&_.code-line-5.code-hl]:!ring-2",
    "[&_.code-line-5.code-hl]:!ring-amber-400/45",
    "[&_.code-line-5.code-hl]:!shadow-[0_0_46px_rgba(251,191,36,0.28),inset_0_0_0_1px_rgba(251,191,36,0.35)]",
  ].join(" "),
  "suspend-7": [
    "[&_.code-hl:not(.code-line-7)]:opacity-25",
    "[&_.code-line-7.code-hl]:!opacity-100",
    "[&_.code-line-7.code-hl]:!bg-amber-500/10",
    "[&_.code-line-7.code-hl]:!border-l-amber-300",
    "[&_.code-line-7.code-hl]:!ring-2",
    "[&_.code-line-7.code-hl]:!ring-amber-400/45",
    "[&_.code-line-7.code-hl]:!shadow-[0_0_46px_rgba(251,191,36,0.28),inset_0_0_0_1px_rgba(251,191,36,0.35)]",
  ].join(" "),
  "suspend-9": [
    "[&_.code-hl:not(.code-line-9)]:opacity-25",
    "[&_.code-line-9.code-hl]:!opacity-100",
    "[&_.code-line-9.code-hl]:!bg-amber-500/10",
    "[&_.code-line-9.code-hl]:!border-l-amber-300",
    "[&_.code-line-9.code-hl]:!ring-2",
    "[&_.code-line-9.code-hl]:!ring-amber-400/45",
    "[&_.code-line-9.code-hl]:!shadow-[0_0_46px_rgba(251,191,36,0.28),inset_0_0_0_1px_rgba(251,191,36,0.35)]",
  ].join(" "),
  "suspend-11": [
    "[&_.code-hl:not(.code-line-11)]:opacity-25",
    "[&_.code-line-11.code-hl]:!opacity-100",
    "[&_.code-line-11.code-hl]:!bg-amber-500/10",
    "[&_.code-line-11.code-hl]:!border-l-amber-300",
    "[&_.code-line-11.code-hl]:!ring-2",
    "[&_.code-line-11.code-hl]:!ring-amber-400/45",
    "[&_.code-line-11.code-hl]:!shadow-[0_0_46px_rgba(251,191,36,0.28),inset_0_0_0_1px_rgba(251,191,36,0.35)]",
  ].join(" "),
  "suspend-13": [
    "[&_.code-hl:not(.code-line-13)]:opacity-25",
    "[&_.code-line-13.code-hl]:!opacity-100",
    "[&_.code-line-13.code-hl]:!bg-amber-500/10",
    "[&_.code-line-13.code-hl]:!border-l-amber-300",
    "[&_.code-line-13.code-hl]:!ring-2",
    "[&_.code-line-13.code-hl]:!ring-amber-400/45",
    "[&_.code-line-13.code-hl]:!shadow-[0_0_46px_rgba(251,191,36,0.28),inset_0_0_0_1px_rgba(251,191,36,0.35)]",
  ].join(" "),
  "suspend-15": [
    "[&_.code-hl:not(.code-line-15)]:opacity-25",
    "[&_.code-line-15.code-hl]:!opacity-100",
    "[&_.code-line-15.code-hl]:!bg-amber-500/10",
    "[&_.code-line-15.code-hl]:!border-l-amber-300",
    "[&_.code-line-15.code-hl]:!ring-2",
    "[&_.code-line-15.code-hl]:!ring-amber-400/45",
    "[&_.code-line-15.code-hl]:!shadow-[0_0_46px_rgba(251,191,36,0.28),inset_0_0_0_1px_rgba(251,191,36,0.35)]",
  ].join(" "),
  // ── rollback family (fuchsia) ─────────────────────────────────────
  "rollback-5": [
    "[&_.code-hl:not(.code-line-5)]:opacity-25",
    "[&_.code-line-5.code-hl]:!opacity-100",
    "[&_.code-line-5.code-hl]:!bg-fuchsia-500/10",
    "[&_.code-line-5.code-hl]:!border-l-fuchsia-300",
    "[&_.code-line-5.code-hl]:!ring-2",
    "[&_.code-line-5.code-hl]:!ring-fuchsia-400/45",
    "[&_.code-line-5.code-hl]:!shadow-[0_0_46px_rgba(232,121,249,0.28),inset_0_0_0_1px_rgba(232,121,249,0.35)]",
  ].join(" "),
  "rollback-7": [
    "[&_.code-hl:not(.code-line-7)]:opacity-25",
    "[&_.code-line-7.code-hl]:!opacity-100",
    "[&_.code-line-7.code-hl]:!bg-fuchsia-500/10",
    "[&_.code-line-7.code-hl]:!border-l-fuchsia-300",
    "[&_.code-line-7.code-hl]:!ring-2",
    "[&_.code-line-7.code-hl]:!ring-fuchsia-400/45",
    "[&_.code-line-7.code-hl]:!shadow-[0_0_46px_rgba(232,121,249,0.28),inset_0_0_0_1px_rgba(232,121,249,0.35)]",
  ].join(" "),
  "rollback-9": [
    "[&_.code-hl:not(.code-line-9)]:opacity-25",
    "[&_.code-line-9.code-hl]:!opacity-100",
    "[&_.code-line-9.code-hl]:!bg-fuchsia-500/10",
    "[&_.code-line-9.code-hl]:!border-l-fuchsia-300",
    "[&_.code-line-9.code-hl]:!ring-2",
    "[&_.code-line-9.code-hl]:!ring-fuchsia-400/45",
    "[&_.code-line-9.code-hl]:!shadow-[0_0_46px_rgba(232,121,249,0.28),inset_0_0_0_1px_rgba(232,121,249,0.35)]",
  ].join(" "),
  "rollback-11": [
    "[&_.code-hl:not(.code-line-11)]:opacity-25",
    "[&_.code-line-11.code-hl]:!opacity-100",
    "[&_.code-line-11.code-hl]:!bg-fuchsia-500/10",
    "[&_.code-line-11.code-hl]:!border-l-fuchsia-300",
    "[&_.code-line-11.code-hl]:!ring-2",
    "[&_.code-line-11.code-hl]:!ring-fuchsia-400/45",
    "[&_.code-line-11.code-hl]:!shadow-[0_0_46px_rgba(232,121,249,0.28),inset_0_0_0_1px_rgba(232,121,249,0.35)]",
  ].join(" "),
  "rollback-13": [
    "[&_.code-hl:not(.code-line-13)]:opacity-25",
    "[&_.code-line-13.code-hl]:!opacity-100",
    "[&_.code-line-13.code-hl]:!bg-fuchsia-500/10",
    "[&_.code-line-13.code-hl]:!border-l-fuchsia-300",
    "[&_.code-line-13.code-hl]:!ring-2",
    "[&_.code-line-13.code-hl]:!ring-fuchsia-400/45",
    "[&_.code-line-13.code-hl]:!shadow-[0_0_46px_rgba(232,121,249,0.28),inset_0_0_0_1px_rgba(232,121,249,0.35)]",
  ].join(" "),
  "rollback-15": [
    "[&_.code-hl:not(.code-line-15)]:opacity-25",
    "[&_.code-line-15.code-hl]:!opacity-100",
    "[&_.code-line-15.code-hl]:!bg-fuchsia-500/10",
    "[&_.code-line-15.code-hl]:!border-l-fuchsia-300",
    "[&_.code-line-15.code-hl]:!ring-2",
    "[&_.code-line-15.code-hl]:!ring-fuchsia-400/45",
    "[&_.code-line-15.code-hl]:!shadow-[0_0_46px_rgba(232,121,249,0.28),inset_0_0_0_1px_rgba(232,121,249,0.35)]",
  ].join(" "),
};

export function CloserRecapSlide({
  primitive,
  title,
  lineNumber,
  setupWorry,
  description,
  sdkExplanation,
}: CloserRecapSlideProps) {
  const explanation = sdkExplanation ?? SDK_EXPLANATION[primitive];
  const family = PRIMITIVE_FAMILY[primitive];
  const spotlightClass =
    SPOTLIGHT_CLASS_BY_KEY[`${family}-${lineNumber}` as SpotlightKey];
  return (
    <div
      data-primitive={primitive}
      className="mx-auto grid h-full w-full max-w-[1720px] grid-cols-[minmax(0,1.25fr)_minmax(440px,0.75fr)] grid-rows-[minmax(0,1fr)_auto] items-center gap-x-12 gap-y-7 overflow-hidden px-14 pt-16 pb-10"
    >
      <section className="flex min-w-0 flex-col gap-8 overflow-hidden">
        <h2 className="text-5xl font-semibold tracking-tight">
          Same shape.
          <span className="text-zinc-500"> Durable underneath.</span>
        </h2>
        <div
          className={`overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-10 ${RECAP_CODE_BASE_CLASS} ${spotlightClass}`}
        >
          <CodeBlock
            code={PLACE_ORDER_DURABLE}
            lang="ts"
            textClass="text-[22px]"
            highlightLines={HIGHLIGHT_LINES}
            suppressTips
          />
        </div>
      </section>
      <aside
        className={`flex min-w-0 flex-col justify-center rounded-3xl border p-10 ${ASIDE_CLASS_BY_FAMILY[family]}`}
      >
        <p
          className={`font-mono text-sm font-semibold uppercase tracking-[0.28em] ${LABEL_CLASS_BY_FAMILY[family]}`}
        >
          line {lineNumber}
        </p>
        <h1
          className={`mt-5 text-7xl font-semibold leading-[1.05] tracking-tight ${TITLE_CLASS_BY_FAMILY[family]}`}
        >
          {title}
        </h1>
        <p className="mt-7 text-3xl leading-tight text-zinc-100">
          {description}
        </p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5">
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.24em] text-zinc-600">
            before
          </p>
          <p className="mt-2 text-2xl leading-snug text-zinc-500">
            {setupWorry}
          </p>
        </div>
        <p className="mt-8 text-2xl leading-snug text-zinc-400">
          {explanation}
        </p>
      </aside>
      <CloserProgressFooter primitive={primitive} />
    </div>
  );
}
