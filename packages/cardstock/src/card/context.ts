"use client";
import type * as React from "react";
import { createContext, useContext, useMemo, useSyncExternalStore } from "react";

import type { CardBackground } from "../background/background";
import type { Progress, Walk } from "../utils/progress";
import type { CardStatus } from "./status";

export interface CardContextValue {
  flipped: boolean;
  frozen: boolean;
  /** Details are showing. Always false while frozen. */
  revealed: boolean;
  setFlipped: (flipped: boolean) => void;
  setFrozen: (frozen: boolean) => void;
  setRevealed: (revealed: boolean) => void;
  /** 0..1 as the details reveal; drives the scramble. */
  reveal: Progress;
  /** 0..1 as the card freezes; drives `<Frost />`. */
  freeze: Progress;
  revealTiming: Walk;
  reducedMotion: boolean;
  /** How the card stands, for display: see `Card.Status`. */
  status: CardStatus | undefined;
  /** What the card is painted with: see `Card.Background`. */
  background: CardBackground | undefined;
  /** The card's `Card.RevealGroup`s, by id. */
  revealGroups: RevealGroupRegistry;
}

/** What a sensitive part shows and hides with: a `Card.RevealGroup`, or the whole card. */
export interface RevealScope {
  /** The group's id; undefined for the card-wide reveal. */
  group: string | undefined;
  /** Showing now. Always false while frozen. */
  revealed: boolean;
  setRevealed: (revealed: boolean) => void;
  /** 0..1 as this scope reveals; drives the scramble. */
  reveal: Progress;
  frozen: boolean;
}

export interface RevealGroupStore {
  get: () => RevealScope;
  subscribe: (listener: () => void) => () => void;
}

export interface RevealGroupRegistry {
  register: (id: string, store: RevealGroupStore) => () => void;
  get: (id: string) => RevealGroupStore | undefined;
  subscribe: (listener: () => void) => () => void;
}

export function createRevealGroupRegistry(): RevealGroupRegistry {
  const groups = new Map<string, RevealGroupStore>();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  return {
    register(id, store) {
      if (groups.has(id)) console.warn(`cardstock: two <Card.RevealGroup>s share the id "${id}".`);
      groups.set(id, store);
      notify();
      return () => {
        if (groups.get(id) !== store) return;
        groups.delete(id);
        notify();
      };
    },
    get: (id) => groups.get(id),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const CardContext: React.Context<CardContextValue | null> = createContext<CardContextValue | null>(
  null,
);

/** The scope of the nearest `Card.RevealGroup` that wraps its parts. */
export const RevealGroupContext: React.Context<RevealScope | null> = createContext<RevealScope | null>(null);

/** The card's state and setters, for building your own parts or driving your own animation. */
export function useCard(): CardContextValue {
  const context = useContext(CardContext);
  if (!context) throw new Error("cardstock: card parts must be rendered inside <Card.Root>.");
  return context;
}

const unsubscribed = () => () => {};

/** The reveal a part follows: the group named by `group`, else the `Card.RevealGroup` around it,
 * else the whole card. A group that isn't mounted (yet) falls back to the whole card. */
export function useRevealScope(group?: string): RevealScope {
  const card = useCard();
  const nearest = useContext(RevealGroupContext);
  const byId = group !== undefined && nearest?.group !== group;
  const registry = card.revealGroups;
  const lookup = () => (byId ? registry.get(group) : undefined);
  const store = useSyncExternalStore(byId ? registry.subscribe : unsubscribed, lookup, lookup);
  const read = () => store?.get();
  const named = useSyncExternalStore(store ? store.subscribe : unsubscribed, read, read);
  const { revealed, setRevealed, reveal, frozen } = card;
  const root = useMemo<RevealScope>(
    () => ({ group: undefined, revealed, setRevealed, reveal, frozen }),
    [revealed, setRevealed, reveal, frozen],
  );
  return named ?? (byId ? root : (nearest ?? root));
}
