import { Card } from "@danolekh/cardstock";

import { PaymentCard } from "../../../registry/cardstock/payment-card";

const button =
  "rounded-lg border border-fd-border px-3 py-1.5 text-sm transition-colors hover:bg-fd-accent disabled:cursor-not-allowed disabled:opacity-50";

// The registry card, uncontrolled. The triggers are cardstock parts too: they read and change the
// card's state from anywhere inside its Root, and `render` lets their label follow that state.
export function PaymentCardDemo() {
  return (
    <PaymentCard
      number="4821 5903 2716 4822"
      holder="Max Mustermann"
      expiry="09/29"
      securityCode="731"
      design="paper"
      spent={842}
      limit={1200}
    >
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Card.RevealTrigger
          className={button}
          render={(props, state) => (
            <button {...props}>{state.pressed ? "Hide details" : "Show details"}</button>
          )}
        />
        <Card.FreezeTrigger
          className={button}
          render={(props, state) => <button {...props}>{state.pressed ? "Unfreeze" : "Freeze"}</button>}
        />
      </div>
    </PaymentCard>
  );
}
