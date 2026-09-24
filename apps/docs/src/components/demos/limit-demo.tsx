import { Card } from "@danolekh/cardstock";
import { useState } from "react";

import { LimitField } from "../../../registry/cardstock/limit-field";

const eur = (n: number) =>
  new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

// The limit field drives a spending meter; the meter is a cardstock part and needs no card.
export function LimitDemo() {
  const [limit, setLimit] = useState(1200);
  return (
    <div className="w-full max-w-sm space-y-5">
      <LimitField value={limit} onValueChange={setLimit} />
      <Card.Spending
        value={842}
        max={limit}
        format={eur}
        className="bg-fd-muted h-2 overflow-hidden rounded-full"
      >
        <Card.SpendingIndicator className="bg-fd-primary h-full origin-left scale-x-(--card-spending-ratio) rounded-full transition-transform duration-300 ease-out" />
      </Card.Spending>
      <p className="text-fd-muted-foreground flex justify-between text-sm">
        <span>This month</span>
        <span className="tabular-nums">
          {eur(842)} of {eur(limit)}
        </span>
      </p>
    </div>
  );
}
