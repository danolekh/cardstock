# cardstock

Headless, composable bank-card primitives for React: flip, tilt, a masked number that decodes, reveal groups with timeouts, copy, freeze with WebGL frost, statuses, storable backgrounds, a spending meter and limit field, and a swipeable carousel.

**[Docs and live demos → cardstock.danolekh.com](https://cardstock.danolekh.com)** · [npm](https://www.npmjs.com/package/@danolekh/cardstock)

[![cardstock: watch the 20-second tour](https://cardstock.danolekh.com/cardstock-poster.jpg)](https://cardstock.danolekh.com/cardstock.mp4)

| Path                   | What                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/cardstock`   | `@danolekh/cardstock`: the library (tsdown, ESM, no CSS)                                                                                 |
| `packages/backgrounds` | `@danolekh/cardstock-backgrounds`: a CLI that downloads the house artwork on demand and prerenders your own backgrounds                  |
| `apps/promo`           | The promo video: a stage of the docs' components and a frame-exact recorder                                                              |
| `apps/docs`            | Docs on Fumadocs + TanStack Start, prerendered, served as Cloudflare static assets. `registry/` holds the styled shadcn-registry copies. |

```bash
pnpm install
pnpm dev          # library in watch mode + docs on :3000
pnpm verify       # lint, format, types, tests and builds, through turbo
```

The tooling is Turborepo, pnpm, oxlint, oxfmt, tsdown (Rolldown + oxc), Vitest and TypeScript 7.

Releases are automatic (`.github/workflows/release.yml`). After CI passes on `main`, each package whose version isn't on npm yet is published and tagged (`v…` for the library, `backgrounds-v…` for the CLI), and the docs are deployed to Cloudflare. To release, bump a version.
