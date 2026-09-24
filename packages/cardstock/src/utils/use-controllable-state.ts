"use client";
import { useCallback, useState } from "react";

/** One piece of state that is either controlled (`value` given) or kept inside, with a change
 * callback either way: the same contract as Base UI's `checked` / `defaultChecked`. */
export function useControllableState<T>(options: {
  value: T | undefined;
  defaultValue: T;
  onChange?: ((value: T) => void) | undefined;
}): [T, (next: T) => void] {
  const { value, defaultValue, onChange } = options;
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const set = useCallback(
    (next: T) => {
      if (Object.is(next, current)) return;
      if (!controlled) setInner(next);
      onChange?.(next);
    },
    [controlled, current, onChange],
  );
  return [current, set];
}
