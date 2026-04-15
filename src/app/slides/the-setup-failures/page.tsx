const FAILURE_MODES = [
  "Server dies mid-order",
  "Payment retries and double-charges",
  "Restaurant takes 10 minutes to respond",
  "Restaurant never responds",
  "20-minute prep window",
  "Support cancels a sleeping order",
  "Customer wants live updates",
  "Three notifications, one fails",
  "Customer disputes a delivered order",
];

export default async function TheSetupFailuresSlide() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-10 px-20">
      <h2 className="text-6xl font-semibold tracking-tight">
        What can go wrong?
      </h2>

      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-10">
        <ul className="grid grid-cols-2 gap-x-12 gap-y-5 font-mono text-3xl leading-snug text-red-200/90">
          {FAILURE_MODES.map((mode, i) => (
            <li key={mode} className="flex gap-6">
              <span className="w-12 shrink-0 text-red-500/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{mode}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
