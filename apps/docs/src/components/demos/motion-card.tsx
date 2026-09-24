import { Card, useCard } from "@danolekh/cardstock";
import { motion } from "motion/react";
import type * as React from "react";

/* Bring your own animation library: `render` swaps a part's element for a motion one, and
 * `useCard()` hands you the state to animate on. Here the flip is a Motion spring with a little
 * bounce, and the card lifts while it turns. */
function Body({ children }: { children: React.ReactNode }) {
  const { flipped } = useCard();
  return (
    <Card.Body
      effect="none"
      render={
        <motion.div
          initial={false}
          animate={{ rotateY: flipped ? 180 : 0, scale: [1, 1.04, 1] }}
          transition={{ rotateY: { type: "spring", stiffness: 180, damping: 16 }, scale: { duration: 0.5 } }}
        />
      }
      className="relative size-full transform-3d"
    >
      {children}
    </Card.Body>
  );
}

const face =
  "absolute inset-0 flex flex-col justify-end gap-2 rounded-2xl p-6 text-left backface-hidden shadow-[0_20px_40px_-20px_rgb(0_0_0/0.6)]";

export function MotionCard() {
  return (
    <Card.Root className="w-full max-w-[340px] perspective-[1000px]">
      <div className="relative aspect-[1.586] w-full">
        <Body>
          <Card.Front className={`${face} bg-gradient-to-br from-violet-500 to-indigo-800 text-white`}>
            <Card.Number
              value="4821 5903 2716 4822"
              className="font-mono text-xl [&_[data-char-state]]:inline-block [&_[data-char-state]]:w-[1ch] [&_[data-char-state]]:text-center"
            />
            <Card.Holder className="text-sm tracking-widest uppercase opacity-80">Max Mustermann</Card.Holder>
          </Card.Front>
          <Card.Back
            className={`${face} [transform:rotateY(180deg)] bg-gradient-to-br from-indigo-800 to-slate-900 text-white`}
          >
            <span className="text-sm opacity-80">
              CVC <Card.SecurityCode value="731" className="font-mono" />
            </span>
          </Card.Back>
        </Body>
        <Card.FlipTrigger
          aria-label="Turn the card over"
          className="absolute inset-0 cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-4"
        />
      </div>
    </Card.Root>
  );
}
