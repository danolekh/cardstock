# cardstock

Headless, composable bank-card primitives for React, with docs at [cardstock.danolekh.com](https://cardstock.danolekh.com).

| Path                 | What                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/cardstock` | `@danolekh/cardstock`: the library (tsdown, ESM, no CSS)                                                                                 |
| `apps/docs`          | Docs on Fumadocs + TanStack Start, prerendered, served as Cloudflare static assets. `registry/` holds the styled shadcn-registry copies. |

```bash
pnpm install
pnpm dev          # library in watch mode + docs on :3000
pnpm verify       # lint, format, types, tests and builds, through turbo
```

The tooling is Turborepo, pnpm, oxlint, oxfmt, tsdown (Rolldown + oxc), Vitest and TypeScript 7.

Release: `pnpm --filter @danolekh/cardstock publish --access public`.
Deploy the docs: `pnpm --filter docs build && pnpm --filter docs exec wrangler deploy`.
