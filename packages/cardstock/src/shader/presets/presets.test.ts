import { composeFragment } from "@danolekh/gl";
import { describe, expect, it } from "vitest";

import { SHADER_PRESETS } from ".";
import { CARD_INPUTS } from "../define";

describe("the built-in presets", () => {
  it("compose, carry a licence, and read the card's inputs", async () => {
    for (const load of Object.values(SHADER_PRESETS)) {
      const def = await load();
      expect(() => composeFragment(def)).not.toThrow();
      expect(def.license).toBeTruthy();
      for (const input of CARD_INPUTS) expect(def.inputs).toContain(input);
    }
  });
});
