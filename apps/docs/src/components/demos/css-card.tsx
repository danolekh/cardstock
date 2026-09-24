import { Card } from "@danolekh/cardstock";

/* The same primitives with no Tailwind and no JavaScript animation: plain CSS reading the parts'
 * data attributes and variables. This is all the styling there is. */
const css = `
.css-card { width: min(100%, 340px); perspective: 1000px; font: 500 15px/1.2 ui-sans-serif, system-ui; }
.css-card .stage { position: relative; aspect-ratio: 1.586; }
/* The flip button lies over the card, so its name is its label and the card text stays its own. */
.css-card [data-slot="card-flip-trigger"] { all: unset; position: absolute; inset: 0; border-radius: 16px; cursor: pointer; }
.css-card [data-slot="card-flip-trigger"]:focus-visible { outline: 2px solid #ef233c; outline-offset: 4px; }
.css-card [data-slot="card-body"] {
  position: relative; height: 100%; transform-style: preserve-3d;
  transform: rotateY(calc(var(--card-flipped) * 180deg));
  transition: transform 500ms cubic-bezier(0.22, 1, 0.36, 1);
}
.css-card [data-slot="card-front"], .css-card [data-slot="card-back"] {
  position: absolute; inset: 0; border-radius: 16px; padding: 22px; box-sizing: border-box;
  backface-visibility: hidden; background: #2b2d42; color: #edf2f4;
  display: flex; flex-direction: column; justify-content: flex-end; gap: 10px;
}
.css-card [data-slot="card-back"] { transform: rotateY(180deg); background: #8d99ae; color: #2b2d42; }
.css-card [data-slot="card-number"] { font: 600 20px ui-monospace, monospace; letter-spacing: 0; }
.css-card [data-char-state] { display: inline-block; width: 1ch; text-align: center; }
/* No scramble: each digit fades up in turn, staggered by its own index. */
.css-card [data-char-state="revealed"] { animation: css-card-in 180ms ease-out both; animation-delay: calc(var(--char-index) * 12ms); }
@keyframes css-card-in { from { opacity: 0; transform: translateY(4px); } }
.css-card [data-slot="card-frozen-overlay"] {
  position: absolute; inset: 0; border-radius: 16px; background: rgb(214 236 255 / 0.55);
  backdrop-filter: blur(3px); transition: opacity 250ms ease;
}
.css-card [data-slot="card-frozen-overlay"][data-starting-style],
.css-card [data-slot="card-frozen-overlay"][data-ending-style] { opacity: 0; }
.css-card .row { display: flex; gap: 8px; margin-top: 16px; justify-content: center; }
.css-card .row button { font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 8px; border: 1px solid #8d99ae; background: none; color: inherit; cursor: pointer; }
.css-card .row button[aria-pressed="true"] { background: #2b2d42; color: #edf2f4; }
.css-card .row button:disabled { opacity: 0.45; cursor: not-allowed; }
`;

export function CssCard() {
  return (
    <Card.Root className="css-card">
      <style>{css}</style>
      <div className="stage">
        <Card.Body effect="none">
          <Card.Front>
            <Card.Number value="4821 5903 2716 4822" reveal="none" />
            <Card.Holder>MAX MUSTERMANN</Card.Holder>
            <Card.FrozenOverlay />
          </Card.Front>
          <Card.Back>
            <span>
              CVC <Card.SecurityCode value="731" reveal="none" />
            </span>
            <Card.FrozenOverlay />
          </Card.Back>
        </Card.Body>
        <Card.FlipTrigger aria-label="Turn the card over" />
      </div>
      <div className="row">
        <Card.RevealTrigger>Details</Card.RevealTrigger>
        <Card.FreezeTrigger>Freeze</Card.FreezeTrigger>
      </div>
    </Card.Root>
  );
}
