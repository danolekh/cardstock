/* What a shader is. The runtime lives in @danolekh/gl, which cardstock shares with other libraries
 * on the page; a card shader is a gl definition that also reads the card's flip and freeze. */

import { defineShader as defineGlShader, type ShaderDefinition, type ShaderParamSpec } from "@danolekh/gl";

export { uniformName, type ShaderDefinition, type ShaderDialect, type ShaderParamSpec } from "@danolekh/gl";

/** What every card shader reads live: `uFlip` and `uFreeze`, the card's 0..1 progress. */
export const CARD_INPUTS = ["flip", "freeze"] as const;

const withInputs = <D extends ShaderDefinition>(definition: D): D =>
  CARD_INPUTS.every((i) => definition.inputs?.includes(i))
    ? definition
    : { ...definition, inputs: [...new Set([...(definition.inputs ?? []), ...CARD_INPUTS])] };

/** Declares a shader. Checks the id and parameter names, and returns the definition with the
 * card's inputs (`uFlip`, `uFreeze`) declared. */
export function defineShader<const P extends Readonly<Record<string, ShaderParamSpec>>>(
  definition: ShaderDefinition<P>,
): ShaderDefinition<P> {
  return defineGlShader(withInputs(definition));
}

const cached = new WeakMap<ShaderDefinition, ShaderDefinition>();

/** The definition as a card draws it: one written without `defineShader` gets the card's inputs
 * too, once, so its identity stays stable for the compiled-program cache. */
export function cardDefinition(definition: ShaderDefinition): ShaderDefinition {
  let d = cached.get(definition);
  if (!d) cached.set(definition, (d = withInputs(definition)));
  return d;
}
