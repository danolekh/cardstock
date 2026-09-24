import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Card, type ShaderBackground, type ShaderParamValue } from "@danolekh/cardstock";
import { loadShaderPreset, Shader, type ShaderDefinition } from "@danolekh/cardstock/shader";
import { useEffect, useState } from "react";

import { SHADERS } from "@/lib/backgrounds";

import { PaymentCard } from "../../../registry/cardstock/payment-card";

type Name = keyof typeof SHADERS;
const NAMES = Object.keys(SHADERS) as Name[];
const button = "rounded-lg border border-fd-border px-3 py-1.5 text-sm transition-colors hover:bg-fd-accent";

// Pick a shader and tune it: the card redraws as you drag, and the JSON under it is the background
// you'd store. The swatches are live too, each a bare `Card.Root` with a <Shader /> in its
// `Card.Background`, all drawn by one WebGL context.
export function ShadersDemo() {
  const [name, setName] = useState<Name>("singularity");
  const [edits, setEdits] = useState<Record<string, ShaderParamValue>>({});
  const [speed, setSpeed] = useState(1);
  const [frozen, setFrozen] = useState(false);
  const definition = useDefinition(SHADERS[name].shader);

  const base = SHADERS[name];
  const background: ShaderBackground = {
    ...base,
    params: { ...base.params, ...edits },
    ...(speed !== 1 ? { speed } : {}),
  };
  const pick = (next: Name) => {
    setName(next);
    setEdits({});
    setSpeed(1);
  };
  const set = (param: string, value: ShaderParamValue) => setEdits((e) => ({ ...e, [param]: value }));

  return (
    <div className="w-full max-w-[560px] space-y-5">
      <PaymentCard
        number="4821 5903 2716 4822"
        holder="Max Mustermann"
        expiry="09/29"
        securityCode="731"
        background={background}
        frozen={frozen}
        onFrozenChange={setFrozen}
      >
        <div className="mt-4 flex justify-center">
          <Card.FreezeTrigger
            className={button}
            render={(props, state) => <button {...props}>{state.pressed ? "Unfreeze" : "Freeze"}</button>}
          />
        </div>
      </PaymentCard>

      <RadioGroup
        aria-label="Shader"
        value={name}
        onValueChange={(value) => pick(value as Name)}
        className="grid grid-cols-4 gap-2"
      >
        {NAMES.map((n) => (
          <Radio.Root
            key={n}
            value={n}
            aria-label={SHADERS[n].label}
            title={SHADERS[n].label}
            className="ring-fd-primary ring-offset-fd-background cursor-pointer rounded-[7%/11%] ring-offset-2 outline-none focus-visible:ring-2 data-checked:ring-2"
          >
            <Card.Root
              background={SHADERS[n]}
              render={<span />}
              className="relative block aspect-[1.586] overflow-hidden rounded-[7%/11%] shadow-sm"
            >
              <Card.Background loading="lazy" render={<span />} className="absolute inset-0">
                <Shader maxDpr={1} />
              </Card.Background>
            </Card.Root>
          </Radio.Root>
        ))}
      </RadioGroup>

      {definition && (
        <div className="border-fd-border space-y-3 rounded-lg border p-4 text-sm">
          <p className="text-fd-muted-foreground">
            {definition.description}
            {definition.credit ? ` ${definition.credit}, ${definition.license}.` : ""}
          </p>
          <Range label="Speed" min={0} max={4} step={0.05} value={speed} onChange={setSpeed} />
          {Object.entries(definition.params ?? {}).map(([param, spec]) => {
            const value = edits[param] ?? base.params?.[param] ?? spec.default;
            if (spec.type === "float")
              return (
                <Range
                  key={param}
                  label={spec.label ?? param}
                  min={spec.min}
                  max={spec.max}
                  step={spec.step ?? (spec.max - spec.min) / 100}
                  value={value as number}
                  onChange={(v) => set(param, v)}
                />
              );
            const colors = spec.type === "color" ? [value as string] : (value as readonly string[]);
            return (
              <div key={param} className="flex items-center gap-3">
                <span className="w-36 shrink-0">{spec.label ?? param}</span>
                <div className="flex flex-wrap gap-1.5">
                  {colors.map((color, i) => (
                    <input
                      key={i}
                      type="color"
                      aria-label={`${spec.label ?? param} ${i + 1}`}
                      value={color}
                      onChange={(e) => {
                        if (spec.type === "color") return set(param, e.target.value);
                        const next = [...colors];
                        next[i] = e.target.value;
                        set(param, next);
                      }}
                      className="border-fd-border h-7 w-9 cursor-pointer rounded border bg-transparent"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <pre className="border-fd-border bg-fd-muted/40 text-fd-muted-foreground max-h-56 overflow-auto rounded-lg border p-3 text-xs leading-relaxed">
        {JSON.stringify(background, null, 2)}
      </pre>
    </div>
  );
}

function Range(props: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-36 shrink-0">{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="accent-fd-primary flex-1"
      />
      <span className="text-fd-muted-foreground w-10 text-right tabular-nums">
        {Math.round(props.value * 100) / 100}
      </span>
    </label>
  );
}

/** A built-in shader's definition, for its parameters' ranges and labels. */
function useDefinition(id: string): ShaderDefinition | undefined {
  const [loaded, setLoaded] = useState<{ id: string; definition: ShaderDefinition } | null>(null);
  useEffect(() => {
    let live = true;
    void loadShaderPreset(id)?.then((definition) => live && setLoaded({ id, definition }));
    return () => {
      live = false;
    };
  }, [id]);
  return loaded?.id === id ? loaded.definition : undefined;
}
