/* The cursor for the recorder, injected into the page: headless Chrome draws none. An ink dot with
 * a white edge, and a ring in the take's accent that shows while the button is down. The accent
 * comes from `window.__cursorAccent`, set before this runs. */
(() => {
  const accent = window.__cursorAccent ?? "#d9482a";
  const make = (style) => Object.assign(document.createElement("div"), { style: style.join(";") });
  const root = make([
    "position:fixed",
    "left:0",
    "top:0",
    "z-index:2147483647",
    "pointer-events:none",
    "opacity:0",
  ]);
  const ring = make([
    "position:absolute",
    "width:34px",
    "height:34px",
    "margin:-17px 0 0 -17px",
    "border-radius:50%",
    `border:2px solid ${accent}`,
    "box-sizing:border-box",
    "opacity:0",
    "scale:0.5",
    "transition:opacity 300ms ease-out, scale 300ms ease-out",
  ]);
  const dot = make([
    "position:absolute",
    "width:16px",
    "height:16px",
    "margin:-8px 0 0 -8px",
    "border-radius:50%",
    "background:#1c1a17",
    "border:2px solid #fff",
    "box-sizing:border-box",
    "box-shadow:0 2px 6px rgb(0 0 0 / 0.35)",
    "transition:scale 150ms",
  ]);
  root.append(ring, dot);
  const press = (down) => {
    ring.style.opacity = down ? "1" : "0";
    ring.style.scale = down ? "1" : "0.5";
    dot.style.scale = down ? "0.8" : "1";
  };
  addEventListener(
    "pointermove",
    (e) => {
      root.style.opacity = "1";
      root.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    },
    true,
  );
  addEventListener("pointerdown", () => press(true), true);
  addEventListener("pointerup", () => press(false), true);
  const mount = () => document.body.append(root);
  if (document.body) mount();
  else addEventListener("DOMContentLoaded", mount);
})();
