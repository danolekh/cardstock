import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Card } from "@danolekh/cardstock";
import { useState } from "react";

import { BACKGROUNDS, type BackgroundName } from "../../../registry/cardstock/backgrounds";
import { PaymentCard } from "../../../registry/cardstock/payment-card";

const NAMES = Object.keys(BACKGROUNDS) as BackgroundName[];
const button = "rounded-lg border border-fd-border px-3 py-1.5 text-sm transition-colors hover:bg-fd-accent";

// A background is data: pick one and the card, its text and its frost all follow it, and the
// JSON below is exactly what you'd store for the card. The swatches are bare cardstock parts,
// `Card.Root` with a `background` and a `Card.Background` inside.
export function BackgroundsDemo() {
  const [name, setName] = useState<BackgroundName>("guilloche");
  const [frozen, setFrozen] = useState(false);
  const background = BACKGROUNDS[name];
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
        spent={842}
        limit={1200}
      >
        <div className="mt-4 flex justify-center">
          <Card.FreezeTrigger
            className={button}
            render={(props, state) => <button {...props}>{state.pressed ? "Unfreeze" : "Freeze"}</button>}
          />
        </div>
      </PaymentCard>

      <RadioGroup
        aria-label="Background"
        value={name}
        onValueChange={(value) => setName(value as BackgroundName)}
        className="grid grid-cols-4 gap-2 sm:grid-cols-7"
      >
        {NAMES.map((n) => (
          <Radio.Root
            key={n}
            value={n}
            aria-label={BACKGROUNDS[n].label}
            title={BACKGROUNDS[n].label}
            className="ring-fd-primary ring-offset-fd-background cursor-pointer rounded-[7%/11%] ring-offset-2 outline-none focus-visible:ring-2 data-checked:ring-2"
          >
            <Card.Root
              background={BACKGROUNDS[n]}
              render={<span />}
              className="relative block aspect-[1.586] overflow-hidden rounded-[7%/11%] shadow-sm"
            >
              <Card.Background loading="lazy" render={<span />} className="absolute inset-0" />
            </Card.Root>
          </Radio.Root>
        ))}
      </RadioGroup>

      <pre className="border-fd-border bg-fd-muted/40 text-fd-muted-foreground max-h-56 overflow-auto rounded-lg border p-3 text-xs leading-relaxed">
        {JSON.stringify(background, null, 2)}
      </pre>
    </div>
  );
}
