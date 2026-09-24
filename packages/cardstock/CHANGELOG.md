# Changelog

## 0.3.0

### Carousel, rewritten

The carousel now lays the slides out itself, as a coverflow drawn in 2D so artwork stays sharp, and needs far less wiring.

**Breaking**

- `CardCarousel.Root` applies the coverflow by default. If you wrote the slide transforms in CSS, add `effect="none"` to keep yours.
- Slides out of focus are `inert` (hidden from assistive tech, out of the tab order, not clickable themselves). A click on one still selects it, through the track. Remove any `tabIndex={-1}` you put on their buttons.
- One slide of drag is now the slide's width plus `gap`, not the track's width.
- `CardCarousel.Indicator` inside the new `CardCarousel.Indicators` is a tab (`role="tab"`), and the slides become its panels.
- Arrow keys typed into a field on a slide no longer move the carousel.
- `PositionStore` comes from `useCarouselPosition()`; `useCardCarousel()` no longer has `position`, `register`, `dragging` or `drag`, and its `count` is `undefined` while server-rendering without a `count` on the root.

**Added**

- `effect`, `gap`, `turn`, `depth`, `fade` on the root, and the variables `--carousel-gap`, `--carousel-turn`, `--carousel-depth`, `--carousel-fade`, `--carousel-direction`.
- `count` on the root, for exact server-rendered HTML; the track counts its children otherwise, and slides no longer need `index`.
- `label` on a slide ("Premium, 2 of 4"), and a slide's children as a function of `{ index, count, active, offset }`, or `useCarouselSlide()`.
- `labels`, to translate everything the carousel reads out, with `DEFAULT_CAROUSEL_LABELS`.
- The viewport is labelled and focusable by default; Home and End; right-to-left (`dir`, or the page's direction).
- `CardCarousel.Indicators`, a tablist with roving focus, rendering one indicator per slide when given none.
- `data-side` and `data-index` on slides; `data-effect` and `data-dir` on the root.
- `useCarouselPosition()`, `useCarouselDragging()` and `releaseVelocity()`.
- `flickVelocity` and `elastic` on the root (still accepted on the track, deprecated).

**Fixed**

- A re-render mid-glide no longer snaps the slides to whole positions for a frame.
- The settle starts before the frame that shows the new index.
- Previous and Next are no longer disabled, and slides no longer read "1 of 0", in server-rendered HTML.
- A drag no longer re-renders every part of the carousel.
- A swipe restyles only the slides: the moving variables are registered as non-inheriting numbers, so they no longer restyle every element on every card each frame (from about 700 elements and 3ms a frame to 9 and 0.3ms on the docs playground; at 4× CPU throttle, from about 95 to 118 fps). To read one inside a slide, copy it into your own variable on the slide.

### Flip

- **Breaking:** `Card.Body` turns the card over itself now, with a **sheen**: a band of light across the face and a shade as it turns away, both from the live angle. If you wrote the flip yourself (CSS on `--card-flipped`, or Motion through `render`), add `effect="none"`.
- `effect` combines styles: `"sheen"` (the default), `"lift"` (rises before it turns, lands after) and `"toward"` (the pressed edge rises toward you; a press near the top or bottom turns it over top to bottom), e.g. `effect={["lift", "sheen"]}`.
- For your own flip, the body writes `--card-flip` (0..1, linear), `--card-flip-angle`, `--card-flip-axis-x`, `--card-flip-direction`, `--card-flip-lift`, `--card-flip-light`, `--card-flip-glow` and `--card-flip-sheen` every frame, `useCard().flip` is the progress, and `flipFrame()` / `flipOriginAt()` are the maths the built-in styles use.
- `flipTiming` on `Card.Root` (750ms each way by default, `FLIP_TIMING`).
- With reduced motion the faces cross-fade instead.

### Tilt

- **Breaking:** the turning moves to the new `Card.TiltSurface`, inside `Card.Tilt`. `Card.Tilt` is now the still hit area: when the element under the pointer turned, a pointer resting near a corner made the card flicker endlessly. Move your tilt transform from `Card.Tilt` onto `Card.TiltSurface`, or use its built-in one (`maxTilt`). In development, `Card.Tilt` warns once if it has a transform of its own.
- `Card.TiltSurface` carries the perspective (`perspective`, 1100 by default) in its own transform.

### Frost

- **Breaking:** `webgl` and `fallback` are gone from `<Frost />`, which is now always the shader. For the gradient without WebGL, use the new `<FrostVeil />` (`background`, `blur`); `FROST_VEIL` is its default gradient.
- `<Frost />` shows the veil itself where WebGL2 isn't there.

### Backgrounds

- New `@danolekh/cardstock/background` entry: the background format with no React, for servers and scripts.
- The house artwork is no longer in the registry: `card-backgrounds` is gone, and `payment-card` ships four gradients. Download artwork with the new `@danolekh/cardstock-backgrounds` CLI (`list`, `add`, and `build` for your own images).

## 0.2.0

Backgrounds as data, reveal groups with timeouts, `Card.CopyTrigger`, `Card.Status` and the limit field.

## 0.1.0

First release.
