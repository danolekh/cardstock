import { CardSwiper } from "../../../registry/cardstock/card-carousel";
import { type CardDesign, DESIGNS, PaymentCard } from "../../../registry/cardstock/payment-card";

const KEYS = Object.keys(DESIGNS) as CardDesign[];

// Drag, flick, use ←/→ on the focused carousel, or press a tab.
export function SwiperDemo() {
  return (
    <CardSwiper labels={KEYS.map((k) => DESIGNS[k].label)}>
      {(i, active) => (
        <PaymentCard
          number="4821 5903 2716 4822"
          holder="Max Mustermann"
          expiry="09/29"
          securityCode="731"
          design={KEYS[i]}
          active={active}
        />
      )}
    </CardSwiper>
  );
}
