import { useRef, useState, type KeyboardEvent } from "react";

// A group of buttons that is one stop for Tab: the arrow keys, Home and End
// move between them (the ARIA toolbar pattern, "roving tabindex"). Disabled
// buttons are skipped.

// The item the key moves to from `current`, or null when the key is not one
// of them or nothing else can take the focus
export function nextIndex(current: number, key: string, enabled: readonly boolean[]): number | null {
  const count = enabled.length;
  const step = key === "ArrowRight" || key === "ArrowDown" ? 1 : key === "ArrowLeft" || key === "ArrowUp" ? -1 : 0;
  if (key === "Home" || key === "End") {
    const order = key === "Home" ? [...enabled.keys()] : [...enabled.keys()].reverse();
    return order.find((index) => enabled[index]) ?? null;
  }
  if (step === 0) return null;
  for (let offset = 1; offset < count; offset++) {
    const index = (((current + step * offset) % count) + count) % count;
    if (enabled[index]) return index;
  }
  return null;
}

// Props for each button: only the last focused one (or the first enabled)
// takes Tab
export function useRovingTabIndex(enabled: readonly boolean[]) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = enabled[active] ? active : Math.max(0, enabled.indexOf(true));

  return (index: number) => ({
    ref: (element: HTMLButtonElement | null) => {
      refs.current[index] = element;
    },
    tabIndex: index === current ? 0 : -1,
    onFocus: () => setActive(index),
    onKeyDown: (event: KeyboardEvent) => {
      const next = nextIndex(index, event.key, enabled);
      if (next === null) return;
      event.preventDefault();
      refs.current[next]?.focus();
    },
  });
}
