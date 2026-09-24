import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import * as React from "react";

// The search dialog (and its index client) loads when someone opens search, not with the page.
const LazySearch = React.lazy(() => import("@/components/search"));
function SearchDialog(props: SharedProps) {
  return (
    <React.Suspense fallback={null}>
      <LazySearch {...props} />
    </React.Suspense>
  );
}

import appCss from "@/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "cardstock: headless bank-card primitives for React" },
      {
        name: "description",
        content:
          "Headless, composable card primitives for React: flip, tilt, a masked number that decodes, freeze with frost, a spending meter and a swipeable card carousel.",
      },
      // The link preview (public/og.png, 1200×630).
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "cardstock" },
      { property: "og:title", content: "cardstock: headless bank-card primitives for React" },
      {
        property: "og:description",
        content:
          "Flip, tilt, a number that decodes, freeze with WebGL frost, a spending meter and a swipeable carousel.",
      },
      { property: "og:url", content: "https://cardstock.danolekh.com" },
      { property: "og:image", content: "https://cardstock.danolekh.com/og.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://cardstock.danolekh.com/og.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ SearchDialog }}>
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
