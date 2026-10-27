
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ZoneId = string;

interface SelectionContextValue {
  selectedZones: ZoneId[];
  toggle: (id: ZoneId) => void;
  clear: () => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedZones, setSelectedZones] = useState<ZoneId[]>([]);

  const value = useMemo(
    () => ({
      selectedZones,
      toggle: (id: ZoneId) =>
        setSelectedZones((prev) => (prev.includes(id) ? prev.filter((zoneId) => zoneId !== id) : [...prev, id])),
      clear: () => setSelectedZones([]),
    }),
    [selectedZones]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("useSelection must be used within a SelectionProvider");
  }
  return context;
}
