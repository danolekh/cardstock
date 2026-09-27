# @danolekh/gl

One WebGL2 context and one animation frame for every live shader on the page. It is the runtime
under [cardstock](https://cardstock.danolekh.com)'s shader backgrounds and [earshot](https://earshot.danolekh.com)'s orb,
so two libraries on one page still share a single context.

```ts
import { defineShader, pageScheduler } from "@danolekh/gl";

const pulse = defineShader({
  id: "acme/pulse",
  label: "Pulse",
  inputs: ["level"],
  source: `void main() { fragColor = vec4(vec3(uLevel), 1.0); }`,
});

const surface = pageScheduler().add(
  canvas,
  { definition: pulse, uniforms: [], speed: 1, state: "play", maxDpr: 2, maxPixels: 1e6 },
  { values: { level: () => analyser.level() } },
  (status) => console.log(status),
);
```

- Definitions in GLSL ES 3.00, Shadertoy (`mainImage`) or twigl dialects.
- Typed parameters (`float`, `color`, `colors`) resolved and clamped from data.
- Live `inputs`: float getters read every frame without re-rendering anything.
- Pauses off screen and in hidden tabs, skips frames that would look the same, caps fps per shader,
  drops resolution when the GPU falls behind, and rebuilds a lost context once.

MIT
