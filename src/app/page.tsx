import Link from "next/link";
import OrderDemo from "./_components/order-demo";

const EXPERIMENTAL = [
  { route: "/v1", name: "Synthwave Arcade", blurb: "80s neon, CRT scanlines, pixel HUD" },
  { route: "/v2", name: "Editorial Monochrome", blurb: "Magazine layout, serif display" },
  { route: "/v3", name: "Playful Cartoon", blurb: "Pastels, rounded, bouncy" },
  { route: "/v4", name: "Terminal / TUI", blurb: "Phosphor green, ASCII boxes, keyboard-first" },
  { route: "/v5", name: "Vision Pro Glass", blurb: "Frosted cards, soft gradients" },
  { route: "/v6", name: "Brutalist Swiss", blurb: "Thick borders, all caps, raw" },
  { route: "/v7", name: "Bloomberg Terminal", blurb: "Dense ticker, amber on black" },
];

const REAL_WORLD = [
  { route: "/v8", name: "Uber Eats", blurb: "Pixel-close Uber Eats clone" },
  { route: "/v9", name: "DoorDash", blurb: "DoorDash red, consumer marketplace" },
  { route: "/v10", name: "Instacart", blurb: "Grocery-forward, fresh green" },
  { route: "/v11", name: "Grubhub", blurb: "Orange-red, Perks badges" },
  { route: "/v12", name: "Postmates Black", blurb: "Dark luxury, gold accents" },
  { route: "/v13", name: "Deliveroo", blurb: "Teal EU, Plus membership" },
  { route: "/v14", name: "Wolt", blurb: "Nordic minimal, Helsinki blue" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Workflow SDK demo
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            GrubSaga
          </h1>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
            A food delivery order orchestrated as a durable saga. Place an
            order and watch the workflow validate → charge → notify restaurant
            → assign driver → track delivery → receipt. Failures anywhere
            unwind compensations in reverse.
          </p>
        </header>

        <nav className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Experimental design variations
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {EXPERIMENTAL.map((v) => (
              <li key={v.route}>
                <Link
                  href={v.route}
                  className="block rounded-lg border border-zinc-200 px-3 py-2 text-sm transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {v.name}
                  </div>
                  <div className="text-xs text-zinc-500">{v.blurb}</div>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="mb-10 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Real-world clones
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {REAL_WORLD.map((v) => (
              <li key={v.route}>
                <Link
                  href={v.route}
                  className="block rounded-lg border border-zinc-200 px-3 py-2 text-sm transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {v.name}
                  </div>
                  <div className="text-xs text-zinc-500">{v.blurb}</div>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <OrderDemo />
      </main>
    </div>
  );
}
