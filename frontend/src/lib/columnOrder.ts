"use client";
import { useEffect, useState } from "react";
import { API, apiFetch } from "@/lib/apiFetch";

/** Reorders `cols` by `order` (a list of keys). Keys not present in `order` keep their
 * original relative position, appended after the ones that are. */
export function applyColumnOrder<T extends { key: string }>(cols: T[], order: string[] | null): T[] {
  if (!order || order.length === 0) return cols;
  const index = new Map(order.map((k, i) => [k, i]));
  return [...cols].sort((a, b) => (index.get(a.key) ?? 999) - (index.get(b.key) ?? 999));
}

/** Fetches the saved column order for a table once on mount. Returns null until loaded
 * (or if none is saved yet), in which case callers should render with the default order. */
export function useColumnOrder(tableName: string): string[] | null {
  const [order, setOrder] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`${API}/api/table-order/${tableName}`)
      .then((res) => (res.ok ? res.json() : { column_order: null }))
      .then((data) => { if (!cancelled) setOrder(data.column_order ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tableName]);

  return order;
}
