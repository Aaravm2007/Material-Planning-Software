import { useEffect, useRef } from "react";

export function usePolling(callback: () => void, intervalMs: number) {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    const id = setInterval(() => saved.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
