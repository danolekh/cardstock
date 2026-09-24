"use client";
import type * as React from "react";
import { useEffect, useState } from "react";

import { type PartProps, usePart } from "../utils/part";
import { useRevealScope } from "./context";

export type CardCopyStatus = "idle" | "copied" | "failed";

export interface CardCopyTriggerState extends Record<string, unknown> {
  disabled: boolean;
  status: CardCopyStatus;
}

export type CardCopyResult = { ok: true } | { ok: false; error: unknown };

export interface CardCopyTriggerProps extends PartProps<"button", CardCopyTriggerState> {
  /** What to copy, e.g. the card number. */
  value: string;
  /** Copy only while this `Card.RevealGroup` shows, instead of the one around it, or the card. */
  group?: string;
  /** Writes the text; by default `navigator.clipboard.writeText`. Throw or reject to fail. */
  copy?: (text: string) => void | Promise<void>;
  /** Told how each copy went, for your own toast or announcement. */
  onCopyResult?: (result: CardCopyResult) => void;
  /** How long `data-status` stays `copied` or `failed` before going back to `idle`. */
  resetMs?: number;
}

const writeClipboard = (text: string) => navigator.clipboard.writeText(text);

/** Copies a detail, and only while it shows: disabled while hidden or frozen, and never copies on
 * its own. `data-status` is `idle`, `copied` or `failed`, for your feedback. Renders a `<button>`. */
export function CardCopyTrigger(props: CardCopyTriggerProps): React.ReactElement {
  const { value, group, copy = writeClipboard, onCopyResult, resetMs = 2000, ...rest } = props;
  const { revealed, group: id } = useRevealScope(group);
  // `n` restarts the reset timer when a second copy lands with the same status.
  const [result, setResult] = useState<{ status: CardCopyStatus; n: number }>({ status: "idle", n: 0 });
  const status = revealed ? result.status : "idle";
  const disabled = !revealed || !!rest.disabled;

  // Hiding the detail clears its feedback at once.
  if (!revealed && result.status !== "idle") setResult({ status: "idle", n: result.n });

  useEffect(() => {
    if (result.status === "idle") return undefined;
    const timer = setTimeout(() => setResult((r) => ({ status: "idle", n: r.n })), resetMs);
    return () => clearTimeout(timer);
  }, [result, resetMs]);

  const settle = (outcome: CardCopyResult) => {
    setResult((r) => ({ status: outcome.ok ? "copied" : "failed", n: r.n + 1 }));
    onCopyResult?.(outcome);
  };

  return usePart("card-copy-trigger", "button", { disabled, status }, rest as never, {
    type: "button",
    disabled,
    "data-reveal-group": id,
    onClick: async () => {
      try {
        await copy(value);
        settle({ ok: true });
      } catch (error) {
        settle({ ok: false, error });
      }
    },
  });
}
