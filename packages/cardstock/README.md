# @danolekh/cardstock

Headless, composable bank-card primitives for React: a card that flips and tilts, a number that stays masked and decodes when revealed (per field, with an optional timeout and a copy action), a frozen state with a WebGL frost, card statuses, a spending meter and limit field, and a carousel you swipe between cards with.

The parts render plain elements and report their state as `data-*` attributes and CSS variables. You choose the styling (Tailwind, CSS, anything) and the animation (CSS, Motion via `render`, or none). The design follows Base UI.

```bash
pnpm add @danolekh/cardstock @base-ui/react
```

**Status:** 0.1.0, pre-1.0 (a minor version may change the API). React 19, `@base-ui/react` ^1.8, ESM only.

```tsx
import { Card } from "@danolekh/cardstock";

<Card.Root>
  <Card.Body>
    <Card.Front>
      <Card.Number value="4821 5903 2716 4822" />
    </Card.Front>
    <Card.Back>
      <Card.SecurityCode value="731" />
    </Card.Back>
  </Card.Body>
  <Card.FlipTrigger aria-label="Turn the card over" />
  <Card.RevealTrigger>Show details</Card.RevealTrigger>
  <Card.FreezeTrigger>Freeze</Card.FreezeTrigger>
</Card.Root>;
```

Docs, live demos and styled copies you can add with the shadcn CLI: **https://cardstock.danolekh.com**

MIT © Dan Olekh
