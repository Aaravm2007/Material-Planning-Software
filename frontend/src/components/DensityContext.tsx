"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface DensityContextType {
  compact: boolean;
  toggle: () => void;
}

const DensityContext = createContext<DensityContextType>({ compact: false, toggle: () => {} });

export function DensityProvider({ children }: { children: ReactNode }) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    setCompact(localStorage.getItem("compact_mode") === "1");
  }, []);

  function toggle() {
    setCompact((c) => {
      localStorage.setItem("compact_mode", c ? "0" : "1");
      return !c;
    });
  }

  return (
    <DensityContext.Provider value={{ compact, toggle }}>
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity() {
  return useContext(DensityContext);
}
