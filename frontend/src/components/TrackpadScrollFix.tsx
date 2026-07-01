"use client";

import { useEffect } from "react";

export default function TrackpadScrollFix() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.deltaX) return;
      let el = e.target as HTMLElement | null;
      while (el && el !== document.documentElement) {
        const ox = window.getComputedStyle(el).overflowX;
        if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 1) {
          e.preventDefault();
          el.scrollLeft += e.deltaX;
          return;
        }
        el = el.parentElement;
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", onWheel, { capture: true });
  }, []);
  return null;
}
