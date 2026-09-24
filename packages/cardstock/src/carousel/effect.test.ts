import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

// A fresh copy each time: registering is once per page.
const load = () => import("./effect");

describe("registerCarouselProperties", () => {
  it("registers the moving variables once, as numbers that don't inherit", async () => {
    const registerProperty = vi.fn<(definition: PropertyDefinition) => void>();
    vi.stubGlobal("CSS", { registerProperty });
    const { registerCarouselProperties, MOVING_PROPERTIES } = await load();
    registerCarouselProperties();
    registerCarouselProperties();
    expect(registerProperty).toHaveBeenCalledTimes(MOVING_PROPERTIES.length);
    for (const name of MOVING_PROPERTIES)
      expect(registerProperty).toHaveBeenCalledWith({
        name,
        syntax: "<number>",
        inherits: false,
        initialValue: "0",
      });
  });

  it("carries on when the browser can't register, or a property already is", async () => {
    vi.stubGlobal("CSS", {
      registerProperty: () => {
        throw new DOMException("already registered", "InvalidModificationError");
      },
    });
    const { registerCarouselProperties } = await load();
    expect(() => registerCarouselProperties()).not.toThrow();
    vi.resetModules();
    vi.stubGlobal("CSS", undefined);
    const again = await load();
    expect(() => again.registerCarouselProperties()).not.toThrow();
  });
});

describe("writeSlide", () => {
  it("writes the stacking only when it changes", async () => {
    const { writeSlide } = await load();
    const writes: string[] = [];
    const vars = new Map<string, string>();
    const el = {
      style: {
        setProperty: (k: string, v: string) => vars.set(k, v),
        set zIndex(v: string) {
          writes.push(v);
        },
        visibility: "",
      },
    } as unknown as HTMLElement;
    writeSlide(el, 0.5, "coverflow");
    writeSlide(el, 0.51, "coverflow");
    writeSlide(el, 0.7, "coverflow");
    expect(writes).toEqual(["95", "93"]);
    expect(vars.get("--slide-offset")).toBe("0.7");
  });
});
