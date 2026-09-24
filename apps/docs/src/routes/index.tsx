import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";

import { PLAYGROUND_BACKGROUNDS } from "@/lib/backgrounds";
import { baseOptions } from "@/lib/layout.shared";

import { CardPlayground } from "../../registry/cardstock/card-playground";

export const Route = createFileRoute("/")({
  component: Home,
});

const features = [
  [
    "Headless",
    "Plain elements with data attributes and CSS variables. No CSS shipped, no animation library required.",
  ],
  ["Composable", "Parts on a namespace with a render prop on each, the way Base UI builds them."],
  [
    "Yours to style",
    "Tailwind, plain CSS or Motion, or copy the styled versions from the registry and change them.",
  ],
] as const;

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-14 px-5 py-14 md:py-20">
        <section className="grid items-center gap-10 md:grid-cols-[1fr_1.1fr]">
          <div>
            <h1 className="font-display text-5xl leading-[1.02] md:text-6xl">
              Bank cards,
              <br />
              <em className="text-fd-primary">in parts.</em>
            </h1>
            <p className="text-fd-muted-foreground mt-5 max-w-md">
              Headless React primitives for payment-card UI: a card that flips and tilts, a number that
              decodes, a freeze with frost, a spending meter and a swipeable carousel. You bring the look and
              the motion.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/docs/$/"
                params={{ _splat: "" }}
                className="bg-fd-primary text-fd-primary-foreground rounded-lg px-4 py-2 text-sm font-medium"
              >
                Read the docs
              </Link>
              <code className="border-fd-border rounded-lg border px-3 py-2 font-mono text-xs">
                pnpm add @danolekh/cardstock @base-ui/react
              </code>
              <span className="text-fd-muted-foreground text-xs">v0.2.0</span>
            </div>
          </div>
          <CardPlayground backgrounds={PLAYGROUND_BACKGROUNDS} />
        </section>
        <section className="border-fd-border grid gap-6 border-t border-dashed pt-10 sm:grid-cols-3">
          {features.map(([title, body]) => (
            <div key={title}>
              <h2 className="font-display text-2xl">{title}</h2>
              <p className="text-fd-muted-foreground mt-2 text-sm">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </HomeLayout>
  );
}
