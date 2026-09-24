/** Everything the carousel reads out, for assistive tech. Pass your own to `labels` on the root to
 * translate them; anything you leave out keeps the English default. */
export interface CardCarouselLabels {
  /** The carousel region. */
  carousel: string;
  /** One slide: its own `label` if it has one, then where it sits, e.g. "Premium, 2 of 4". */
  slide: (index: number, count: number, label?: string) => string;
  previous: string;
  next: string;
  /** The group of indicators. */
  indicators: string;
  /** One indicator, when it has no text of its own. */
  indicator: (index: number, count: number) => string;
}

export const DEFAULT_CAROUSEL_LABELS: CardCarouselLabels = {
  carousel: "Cards",
  slide: (index, count, label) => `${label ? `${label}, ` : ""}${index + 1} of ${count}`,
  previous: "Previous card",
  next: "Next card",
  indicators: "Choose a card",
  indicator: (index) => `Card ${index + 1}`,
};
