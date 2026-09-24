import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Card, type CardCopyResult } from "../index";

afterEach(cleanup);

function Example(props: React.ComponentProps<typeof Card.Root>) {
  return (
    <Card.Root {...props}>
      <Card.Body>
        <Card.Front>
          <Card.Number value="4821 5903 2716 4822" />
        </Card.Front>
        <Card.Back>
          <Card.SecurityCode value="731" />
        </Card.Back>
      </Card.Body>
      <Card.FlipTrigger>Flip</Card.FlipTrigger>
      <Card.RevealTrigger>Details</Card.RevealTrigger>
      <Card.FreezeTrigger>Freeze</Card.FreezeTrigger>
    </Card.Root>
  );
}

const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`) as HTMLElement;

describe("Card", () => {
  it("renders headless parts with slots and no styles", () => {
    render(<Example />);
    for (const name of ["card", "card-body", "card-front", "card-back", "card-number"])
      expect(slot(name)).toBeTruthy();
    expect(slot("card").getAttribute("style")).toBeNull();
  });

  it("flips with the trigger and hides the face turned away", () => {
    render(<Example />);
    expect(slot("card-back").hasAttribute("inert")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Flip" }));
    expect(slot("card").hasAttribute("data-flipped")).toBe(true);
    expect(slot("card-body").style.getPropertyValue("--card-flipped")).toBe("1");
    expect(slot("card-front").getAttribute("aria-hidden")).toBe("true");
    expect(slot("card-back").hasAttribute("inert")).toBe(false);
  });

  it("labels the number by what is showing", () => {
    render(<Example />);
    expect(slot("card-number").textContent).toContain("Card number ending in 4822");
    expect(slot("card-number").querySelector("[aria-hidden]")?.textContent).toBe("•••• •••• •••• 4822");
  });

  it("masks and disables the reveal while frozen, and tells a controlled owner", () => {
    const onRevealedChange = vi.fn<(revealed: boolean) => void>();
    const { rerender } = render(<Example revealed onRevealedChange={onRevealedChange} />);
    expect(slot("card").hasAttribute("data-revealed")).toBe(true);
    rerender(<Example revealed frozen onRevealedChange={onRevealedChange} />);
    expect(slot("card").hasAttribute("data-revealed")).toBe(false);
    expect(slot("card").hasAttribute("data-frozen")).toBe(true);
    expect((screen.getByRole("button", { name: "Details" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onRevealedChange).toHaveBeenCalledWith(false);
  });

  it("works uncontrolled with defaults and reports changes", () => {
    const onFrozenChange = vi.fn<(frozen: boolean) => void>();
    render(<Example defaultFrozen onFrozenChange={onFrozenChange} />);
    const freeze = screen.getByRole("button", { name: "Freeze" });
    expect(freeze.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(freeze);
    expect(onFrozenChange).toHaveBeenCalledWith(false);
    expect(freeze.getAttribute("aria-pressed")).toBe("false");
  });

  it("takes className and style as functions of state, and render to swap the element", () => {
    render(
      <Card.Root defaultFlipped className={(s) => (s.flipped ? "is-flipped" : "")} render={<section />}>
        <Card.Body style={(s) => ({ opacity: s.flipped ? 0.5 : 1 })} />
      </Card.Root>,
    );
    expect(slot("card").tagName).toBe("SECTION");
    expect(slot("card").className).toBe("is-flipped");
    expect(slot("card-body").style.opacity).toBe("0.5");
  });

  it("walks the reveal to the full number", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance"] });
    render(<Example defaultRevealed={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    await act(async () => void vi.advanceTimersByTime(400));
    expect(slot("card-number").querySelector("[aria-hidden]")?.textContent).toBe("4821 5903 2716 4822");
    vi.useRealTimers();
  });
});

function Groups(
  props: React.ComponentProps<typeof Card.Root> & {
    number?: Partial<React.ComponentProps<typeof Card.RevealGroup>>;
    code?: Partial<React.ComponentProps<typeof Card.RevealGroup>>;
  },
) {
  const { number, code, ...root } = props;
  return (
    <Card.Root {...root}>
      <Card.RevealGroup id="number" {...number} />
      <Card.RevealGroup id="code" {...code} />
      <Card.Body>
        <Card.Front>
          <Card.Number group="number" value="4821 5903 2716 4822" reveal="none" />
        </Card.Front>
        <Card.Back>
          <Card.SecurityCode group="code" value="731" reveal="none" />
        </Card.Back>
      </Card.Body>
      <Card.RevealTrigger group="number">Show number</Card.RevealTrigger>
      <Card.RevealTrigger group="code">Show code</Card.RevealTrigger>
      <Card.FreezeTrigger>Freeze</Card.FreezeTrigger>
    </Card.Root>
  );
}

const shown = (name: string) => slot(name).hasAttribute("data-revealed");
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("Card.RevealGroup", () => {
  afterEach(() => void vi.useRealTimers());

  it("reveals each group on its own, across faces", () => {
    render(<Groups />);
    expect(slot("card-number").getAttribute("data-reveal-group")).toBe("number");
    fireEvent.click(button("Show number"));
    expect(shown("card-number")).toBe(true);
    expect(shown("card-security-code")).toBe(false);
    expect(button("Show number").getAttribute("aria-pressed")).toBe("true");
    expect(button("Show code").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button("Show code"));
    expect(shown("card-security-code")).toBe(true);
    fireEvent.click(button("Show number"));
    expect(shown("card-number")).toBe(false);
    expect(shown("card-security-code")).toBe(true);
  });

  it("follows the group around it when a part names none", () => {
    render(
      <Card.Root>
        <Card.RevealGroup id="code" defaultRevealed>
          <Card.SecurityCode value="731" />
        </Card.RevealGroup>
        <Card.Number value="4821 5903 2716 4822" />
      </Card.Root>,
    );
    expect(shown("card-security-code")).toBe(true);
    expect(shown("card-number")).toBe(false);
  });

  it("shows every group while the card is revealed, and hiding one ends that", () => {
    const onRevealedChange = vi.fn<(revealed: boolean) => void>();
    render(<Groups defaultRevealed onRevealedChange={onRevealedChange} />);
    expect(shown("card-number")).toBe(true);
    expect(shown("card-security-code")).toBe(true);
    fireEvent.click(button("Show number"));
    expect(onRevealedChange).toHaveBeenCalledWith(false);
    expect(shown("card-number")).toBe(false);
    expect(shown("card-security-code")).toBe(false);
  });

  it("hides a group after its timeout and says so", () => {
    vi.useFakeTimers();
    const onRevealedChange = vi.fn<(revealed: boolean) => void>();
    render(<Groups number={{ timeoutMs: 1000, onRevealedChange }} />);
    fireEvent.click(button("Show number"));
    expect(shown("card-number")).toBe(true);
    act(() => void vi.advanceTimersByTime(999));
    expect(shown("card-number")).toBe(true);
    act(() => void vi.advanceTimersByTime(1));
    expect(shown("card-number")).toBe(false);
    expect(onRevealedChange).toHaveBeenLastCalledWith(false);
  });

  it("leaves a controlled group to its owner when the timeout fires", () => {
    vi.useFakeTimers();
    const onRevealedChange = vi.fn<(revealed: boolean) => void>();
    render(<Groups number={{ revealed: true, timeoutMs: 1000, onRevealedChange }} />);
    act(() => void vi.advanceTimersByTime(1000));
    expect(onRevealedChange).toHaveBeenCalledWith(false);
    expect(shown("card-number")).toBe(true);
  });

  it("hides the card-wide reveal after revealTimeoutMs", () => {
    vi.useFakeTimers();
    render(<Example defaultRevealed revealTimeoutMs={500} />);
    expect(slot("card").hasAttribute("data-revealed")).toBe(true);
    act(() => void vi.advanceTimersByTime(500));
    expect(slot("card").hasAttribute("data-revealed")).toBe(false);
  });

  it("hides and disables every group while frozen, and tells each owner", () => {
    const number = vi.fn<(revealed: boolean) => void>();
    const code = vi.fn<(revealed: boolean) => void>();
    render(
      <Groups
        number={{ defaultRevealed: true, onRevealedChange: number }}
        code={{ defaultRevealed: true, onRevealedChange: code }}
      />,
    );
    fireEvent.click(button("Freeze"));
    expect(shown("card-number")).toBe(false);
    expect(shown("card-security-code")).toBe(false);
    expect(button("Show number").disabled).toBe(true);
    expect(number).toHaveBeenCalledWith(false);
    expect(code).toHaveBeenCalledWith(false);
  });
});

describe("Card.CopyTrigger", () => {
  afterEach(() => void vi.useRealTimers());

  function Copyable(props: Partial<React.ComponentProps<typeof Card.CopyTrigger>> & { timeoutMs?: number }) {
    const { timeoutMs, ...copy } = props;
    return (
      <Card.Root>
        <Card.RevealGroup id="number" timeoutMs={timeoutMs} />
        <Card.Number group="number" value="4821 5903 2716 4822" />
        <Card.RevealTrigger group="number">Show number</Card.RevealTrigger>
        <Card.CopyTrigger group="number" value="4821590327164822" {...copy}>
          Copy
        </Card.CopyTrigger>
        <Card.FreezeTrigger>Freeze</Card.FreezeTrigger>
      </Card.Root>
    );
  }

  it("is disabled until its detail shows, and never copies on reveal", () => {
    const copy = vi.fn<(text: string) => void>();
    render(<Copyable copy={copy} />);
    expect(button("Copy").disabled).toBe(true);
    fireEvent.click(button("Show number"));
    expect(button("Copy").disabled).toBe(false);
    expect(copy).not.toHaveBeenCalled();
    fireEvent.click(button("Freeze"));
    expect(button("Copy").disabled).toBe(true);
  });

  it("copies the value and reports success, then settles back to idle", async () => {
    vi.useFakeTimers();
    const copy = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    const onCopyResult = vi.fn<(result: CardCopyResult) => void>();
    render(<Copyable copy={copy} onCopyResult={onCopyResult} resetMs={1000} />);
    fireEvent.click(button("Show number"));
    await act(async () => void fireEvent.click(button("Copy")));
    expect(copy).toHaveBeenCalledWith("4821590327164822");
    expect(onCopyResult).toHaveBeenCalledWith({ ok: true });
    expect(button("Copy").getAttribute("data-status")).toBe("copied");
    act(() => void vi.advanceTimersByTime(1000));
    expect(button("Copy").getAttribute("data-status")).toBe("idle");
  });

  it("reports a failed copy", async () => {
    const error = new Error("denied");
    const onCopyResult = vi.fn<(result: CardCopyResult) => void>();
    render(<Copyable copy={() => Promise.reject(error)} onCopyResult={onCopyResult} />);
    fireEvent.click(button("Show number"));
    await act(async () => void fireEvent.click(button("Copy")));
    expect(onCopyResult).toHaveBeenCalledWith({ ok: false, error });
    expect(button("Copy").getAttribute("data-status")).toBe("failed");
  });

  it("is disabled again, and its feedback cleared, once the detail times out", async () => {
    vi.useFakeTimers();
    render(<Copyable copy={() => {}} timeoutMs={500} resetMs={5000} />);
    fireEvent.click(button("Show number"));
    await act(async () => void fireEvent.click(button("Copy")));
    expect(button("Copy").getAttribute("data-status")).toBe("copied");
    act(() => void vi.advanceTimersByTime(500));
    expect(button("Copy").disabled).toBe(true);
    expect(button("Copy").getAttribute("data-status")).toBe("idle");
  });
});

describe("Card.Status", () => {
  function Stated(props: {
    status?: React.ComponentProps<typeof Card.Root>["status"];
    keepMounted?: boolean;
  }) {
    return (
      <Card.Root status={props.status}>
        <Card.Status keepMounted={props.keepMounted}>
          {(status) => (status === "locked" ? "Locked by your bank" : `Card ${status}`)}
        </Card.Status>
      </Card.Root>
    );
  }

  it("sets data-status on the root only when given", () => {
    const { rerender } = render(<Stated />);
    expect(slot("card").hasAttribute("data-status")).toBe(false);
    rerender(<Stated status="pending" />);
    expect(slot("card").getAttribute("data-status")).toBe("pending");
  });

  it("shows the app's text for a status other than active", () => {
    const { rerender } = render(<Stated status="active" />);
    expect(slot("card-status")).toBeNull();
    rerender(<Stated status="locked" />);
    expect(slot("card-status").textContent).toBe("Locked by your bank");
    expect(slot("card-status").getAttribute("data-status")).toBe("locked");
    expect(slot("card-status").hasAttribute("data-open")).toBe(true);
    rerender(<Stated status="expired" />);
    expect(slot("card-status").textContent).toBe("Card expired");
  });

  it("keeps the last status while it leaves, and stays mounted when asked", () => {
    const { rerender } = render(<Stated status="inactive" keepMounted />);
    rerender(<Stated status="active" keepMounted />);
    expect(slot("card-status").hasAttribute("data-open")).toBe(false);
    expect(slot("card-status").textContent).toBe("Card inactive");
  });
});

describe("Card.Background", () => {
  const gradient = {
    type: "linear",
    stops: [
      ["#34322d", 0],
      ["#080807", 1],
    ],
  } as const;
  const image = {
    type: "image",
    src: "/bg/holo.webp",
    srcSet: "/bg/holo-860.webp 860w",
    color: "#6d5a8f",
  } as const;

  it("tells the root its type and tone", () => {
    render(<Card.Root background={{ type: "solid", color: "#fbf8f1" }} />);
    expect(slot("card").getAttribute("data-background")).toBe("solid");
    expect(slot("card").getAttribute("data-tone")).toBe("light");
  });

  it("paints a gradient on itself", () => {
    render(
      <Card.Root background={gradient}>
        <Card.Background />
      </Card.Root>,
    );
    expect(slot("card-background").style.backgroundImage).toContain("linear-gradient(135deg");
    expect(slot("card-background").getAttribute("data-type")).toBe("linear");
    expect(slot("card-background").getAttribute("aria-hidden")).toBe("true");
  });

  it("draws an image over its colour, and reports how it loaded", () => {
    render(
      <Card.Root background={image}>
        <Card.Background loading="lazy" />
      </Card.Root>,
    );
    const img = slot("card-background-image") as HTMLImageElement;
    expect(img.getAttribute("srcset")).toBe("/bg/holo-860.webp 860w");
    expect(img.getAttribute("alt")).toBe("");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(slot("card-background").style.backgroundColor).toBeTruthy();
    expect(slot("card-background").hasAttribute("data-loaded")).toBe(false);
    fireEvent.load(img);
    expect(slot("card-background").hasAttribute("data-loaded")).toBe(true);
  });

  it("marks a failed image, leaving its colour", () => {
    render(
      <Card.Root background={image}>
        <Card.Background />
      </Card.Root>,
    );
    fireEvent.error(slot("card-background-image"));
    expect(slot("card-background").hasAttribute("data-error")).toBe(true);
  });

  it("paints its own value over the card's", () => {
    render(
      <Card.Root background={image}>
        <Card.Background value={{ type: "solid", color: "#111" }} />
      </Card.Root>,
    );
    expect(slot("card-background").getAttribute("data-type")).toBe("solid");
    expect(slot("card-background-image")).toBeNull();
  });
});
