import { PLAYGROUND_BACKGROUNDS } from "@/lib/backgrounds";

import { CardPlayground } from "../../../registry/cardstock/card-playground";

// The registry's playground with the house artwork mixed in; it defaults to the four gradients.
export function PlaygroundDemo() {
  return <CardPlayground backgrounds={PLAYGROUND_BACKGROUNDS} />;
}
