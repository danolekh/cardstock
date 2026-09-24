import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LimitField } from "./index";

afterEach(cleanup);

function Example(props: { onChange?: (value: number) => void }) {
  const [value, setValue] = useState(1000);
  return (
    <LimitField.Root
      value={value}
      onValueChange={(v) => (setValue(v), props.onChange?.(v))}
      min={500}
      max={1100}
      step={50}
      currency="EUR"
      locale="en-US"
    >
      <LimitField.ScrubArea>
        <LimitField.Label>Monthly limit</LimitField.Label>
      </LimitField.ScrubArea>
      <LimitField.Group>
        <LimitField.Decrement>−</LimitField.Decrement>
        <LimitField.Input />
        <LimitField.Increment>+</LimitField.Increment>
      </LimitField.Group>
    </LimitField.Root>
  );
}

const input = () => screen.getByLabelText("Monthly limit") as HTMLInputElement;

describe("LimitField", () => {
  it("labels the input and formats the value as currency", () => {
    render(<Example />);
    expect(input().value).toBe("€1,000");
    expect(document.querySelector('[data-slot="limit-field"]')).toBeTruthy();
    expect(input().getAttribute("data-slot")).toBe("limit-field-input");
  });

  it("steps with the arrow keys, five steps with Shift, and clamps to max", () => {
    const onChange = vi.fn<(value: number) => void>();
    render(<Example onChange={onChange} />);
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith(1050);
    fireEvent.keyDown(input(), { key: "ArrowDown", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(800);
    fireEvent.click(screen.getByRole("button", { name: /increase/i }));
    fireEvent.click(screen.getByRole("button", { name: /increase/i }));
    fireEvent.keyDown(input(), { key: "ArrowUp", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(1100);
  });

  it("doesn't report an emptied input", () => {
    const onChange = vi.fn<(value: number) => void>();
    render(<Example onChange={onChange} />);
    fireEvent.change(input(), { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
