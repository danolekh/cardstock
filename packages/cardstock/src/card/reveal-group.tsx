"use client";
import type * as React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useProgress } from "../utils/progress";
import { useControllableState } from "../utils/use-controllable-state";
import { RevealGroupContext, type RevealGroupStore, type RevealScope, useCard } from "./context";

export interface CardRevealGroupProps {
  /** Names the group, so parts outside it can join with `group="…"`. */
  id: string;
  /** Whether this group is showing, apart from the card-wide `revealed`. */
  revealed?: boolean;
  defaultRevealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  /** Hide again this long after revealing. Off by default. */
  timeoutMs?: number;
  /** Parts inside follow this group without naming it. */
  children?: React.ReactNode;
}

/** Details that show and hide on their own: the number, say, apart from the security code. Parts
 * follow it when they sit inside it or name it with `group`, so a trigger outside the card can
 * drive a field on its back face. The card-wide `revealed` shows every group; hiding a group while
 * it's on ends that too. Freezing hides every group. Renders no element. */
export function CardRevealGroup(props: CardRevealGroupProps): React.ReactElement {
  const {
    id,
    revealed: revealedProp,
    defaultRevealed = false,
    onRevealedChange,
    timeoutMs,
    children,
  } = props;
  const card = useCard();
  const [own, setOwn] = useControllableState({
    value: revealedProp,
    defaultValue: defaultRevealed,
    onChange: onRevealedChange,
  });
  const { frozen, revealed: all, setRevealed: setAll } = card;
  const revealed = (own || all) && !frozen;

  // As on the root: freezing hides the group, and says so to a controlled owner.
  useEffect(() => {
    if (frozen && own) setOwn(false);
  }, [frozen, own, setOwn]);

  const reveal = useProgress(revealed, card.revealTiming, card.reducedMotion);
  const scope = useMemo<RevealScope>(
    () => ({
      group: id,
      revealed,
      setRevealed: (next) => {
        if (!next && all) setAll(false);
        setOwn(next);
      },
      reveal,
      frozen,
    }),
    [id, revealed, all, setAll, setOwn, reveal, frozen],
  );

  useRevealTimeout(revealed, timeoutMs, scope.setRevealed);

  const [store] = useState(() => createStore(scope));
  useLayoutEffect(() => store.set(scope), [store, scope]);
  useLayoutEffect(() => card.revealGroups.register(id, store), [card.revealGroups, id, store]);

  return <RevealGroupContext.Provider value={scope}>{children}</RevealGroupContext.Provider>;
}

function createStore(initial: RevealScope): RevealGroupStore & { set: (scope: RevealScope) => void } {
  let scope = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => scope,
    set(next) {
      if (next === scope) return;
      scope = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Hides `timeoutMs` after each reveal; hiding sooner, or unmounting, cancels it. */
export function useRevealTimeout(
  revealed: boolean,
  timeoutMs: number | undefined,
  setRevealed: (revealed: boolean) => void,
): void {
  const hide = useRef(setRevealed);
  useLayoutEffect(() => {
    hide.current = setRevealed;
  });
  useEffect(() => {
    if (!revealed || !timeoutMs || timeoutMs <= 0) return undefined;
    const timer = setTimeout(() => hide.current(false), timeoutMs);
    return () => clearTimeout(timer);
  }, [revealed, timeoutMs]);
}
