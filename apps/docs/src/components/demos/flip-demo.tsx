import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Card, type CardFlipStyle } from "@danolekh/cardstock";
import { useState } from "react";

import { PaymentCard } from "../../../registry/cardstock/payment-card";

const STYLES: { value: CardFlipStyle; label: string }[] = [
  { value: "sheen", label: "Sheen" },
  { value: "lift", label: "Lift" },
  { value: "toward", label: "Toward the tap" },
];
const pill =
  "rounded-full border border-fd-border px-3 py-1 text-sm transition-colors hover:text-fd-foreground data-pressed:border-fd-foreground data-pressed:bg-fd-foreground data-pressed:text-fd-background";

// The flip styles combine: pick any of them and tap the card, anywhere. With "toward", the edge
// you press rises toward you, and a press near the top or bottom turns it over top to bottom.
export function FlipDemo() {
  const [styles, setStyles] = useState<CardFlipStyle[]>(["sheen"]);
  return (
    <div className="w-full max-w-[560px] space-y-6">
      <PaymentCard
        number="4821 5903 2716 4822"
        holder="Max Mustermann"
        expiry="09/29"
        securityCode="731"
        design="ink"
        spent={842}
        limit={1200}
        flip={styles.length ? styles : "none"}
      >
        <div className="mt-6 flex justify-center">
          <Card.FlipTrigger
            className="border-fd-border hover:bg-fd-accent rounded-lg border px-3 py-1.5 text-sm transition-colors"
            render={(props, state) => <button {...props}>{state.pressed ? "Front" : "Back"}</button>}
          />
        </div>
      </PaymentCard>
      <ToggleGroup
        multiple
        value={styles}
        onValueChange={(v) => setStyles(v as CardFlipStyle[])}
        aria-label="Flip styles"
        className="flex flex-wrap justify-center gap-1.5"
      >
        {STYLES.map((s) => (
          <Toggle key={s.value} value={s.value} className={pill}>
            {s.label}
          </Toggle>
        ))}
      </ToggleGroup>
      <p className="text-fd-muted-foreground text-center font-mono text-xs">
        {`<Card.Body effect={${styles.length ? JSON.stringify(styles.length === 1 ? styles[0] : styles) : '"none"'}} />`}
      </p>
    </div>
  );
}
