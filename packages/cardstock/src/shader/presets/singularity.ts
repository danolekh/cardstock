/* "Singularity" by Xor (@XorDev): a black hole whirling its accretion disk. MIT licensed, from
 * https://github.com/XorDev/Singularity (the commented Shadertoy version, with the golfing credits
 * to FabriceNeyret2, dean_the_coder and iq). Ported as written; the zoom and hue are ours. */

import { defineShader, type ShaderDefinition } from "../define";

export const singularity: ShaderDefinition<{
  zoom: { type: "float"; default: 1; min: 0.5; max: 2; step: 0.01; label: "Zoom" };
  hue: { type: "float"; default: 0; min: 0; max: 1; step: 0.01; label: "Hue" };
}> = defineShader({
  id: "singularity",
  label: "Singularity",
  description: "A whirling black hole and its accretion disk.",
  credit: "“Singularity” by Xor (@XorDev)",
  license: "MIT",
  dialect: "shadertoy",
  tone: "dark",
  still: 7.5,
  params: {
    zoom: { type: "float", default: 1, min: 0.5, max: 2, step: 0.01, label: "Zoom" },
    hue: { type: "float", default: 0, min: 0, max: 1, step: 0.01, label: "Hue" },
  },
  source: `
// Turns a colour around the grey axis: the disk in other hues, its lights and darks kept.
vec3 hueShift(vec3 c, float turn) {
  const vec3 k = vec3(0.57735);
  float a = turn * 6.28318;
  return c * cos(a) + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - cos(a));
}

void mainImage(out vec4 O, vec2 F)
{
    //Iterator and attenuation (distance-squared)
    float i = .2, a;
    //Resolution for scaling and centering
    vec2 r = iResolution.xy,
         //Centered ratio-corrected coordinates
         p = ( F+F - r ) / r.y / (.7 * uZoom),
         //Diagonal vector for skewing
         d = vec2(-1,1),
         //Blackhole center
         b = p - i*d,
         //Rotate and apply perspective
         c = p * mat2(1, 1, d/(.1 + i/dot(b,b))),
         //Rotate into spiraling coordinates
         v = c * mat2(cos(.5*log(a=dot(c,c)) + iTime*i + vec4(0,33,11,0)))/i,
         //Waves cumulative total for coloring
         w;

    //Loop through waves
    for(; i++<9.; w += 1.+sin(v) )
        //Distort coordinates
        v += .7* sin(v.yx*i+iTime) / i + .5;
    //Acretion disk radius
    i = length( sin(v/.3)*.4 + c*(3.+d) );
    //Red/blue gradient
    O = 1. - exp( -exp( c.x * vec4(.6,-.4,-1,0) )
                   //Wave coloring
                   /  w.xyyx
                   //Acretion disk brightness
                   / ( 2. + i*i/4. - i )
                   //Center darkness
                   / ( .5 + 1. / a )
                   //Rim highlight
                   / ( .03 + abs( length(p)-.7 ) )
             );
    O.rgb = clamp(hueShift(O.rgb, uHue), 0., 1.);
}
`,
});
