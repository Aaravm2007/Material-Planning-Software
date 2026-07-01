"use client";
import { useState, useMemo, useEffect, useCallback } from "react";

export type FilterColType = "text" | "date" | "amount" | "select";
export type DateMode = "exact" | "week" | "month" | "year" | "range" | "month_range";

export interface TextFilter   { mode: "text";   value: string }
export interface DateFilter   { mode: "date";   dateMode: DateMode; exact?: string; from?: string; to?: string; year?: string; month?: string; fromYear?: string; fromMonth?: string; toYear?: string; toMonth?: string }
export interface AmountFilter { mode: "amount"; min?: string; max?: string }
export interface SelectFilter { mode: "select"; values: string[] }
export type FilterValue = TextFilter | DateFilter | AmountFilter | SelectFilter;

export interface SortState { key: string; dir: "asc" | "desc" }

export interface ColDef {
  key: string;
  label: string;
  type: FilterColType;
  options?: string[];
}

function isFilterActive(f: FilterValue | undefined): boolean {
  if (!f) return false;
  switch (f.mode) {
    case "text":   return !!f.value.trim();
    case "date":   return !!(f.exact || f.from || f.to || f.year || f.month || f.fromYear || f.fromMonth || f.toYear || f.toMonth);
    case "amount": return !!(f.min || f.max);
    case "select": return f.values.length > 0;
  }
}

function getWeekRange(ref: string): [string, string] {
  const d = new Date(ref);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

function matchesFilter(rawVal: unknown, f: FilterValue): boolean {
  const val = String(rawVal ?? "").trim();

  switch (f.mode) {
    case "text":
      if (!f.value.trim()) return true;
      return val.toLowerCase().includes(f.value.toLowerCase());

    case "date": {
      if (!val) return false;
      switch (f.dateMode) {
        case "exact":       return !f.exact || val === f.exact;
        case "week": {
          if (!f.from) return true;
          const [ws, we] = getWeekRange(f.from);
          return val >= ws && val <= we;
        }
        case "month":
          return (!f.year  || val.startsWith(f.year)) &&
                 (!f.month || val.slice(5, 7) === f.month.padStart(2, "0"));
        case "year":        return !f.year || val.startsWith(f.year);
        case "range":       return (!f.from || val >= f.from) && (!f.to || val <= f.to);
        case "month_range": {
          const ym   = val.slice(0, 7);
          const from = f.fromYear && f.fromMonth ? `${f.fromYear}-${f.fromMonth.padStart(2, "0")}` : null;
          const to   = f.toYear   && f.toMonth   ? `${f.toYear}-${f.toMonth.padStart(2, "0")}`   : null;
          return (!from || ym >= from) && (!to || ym <= to);
        }
        default: return true;
      }
    }

    case "amount": {
      const num = parseFloat(val.replace(/,/g, ""));
      if (isNaN(num)) return !f.min && !f.max;
      if (f.min && num < parseFloat(f.min.replace(/,/g, ""))) return false;
      if (f.max && num > parseFloat(f.max.replace(/,/g, ""))) return false;
      return true;
    }

    case "select":
      if (f.values.length === 0) return true;
      return f.values.includes(val);
  }
}

function applySortRows<T extends Record<string, unknown>>(rows: T[], sort: SortState, colType: FilterColType): T[] {
  return [...rows].sort((a, b) => {
    const av = String(a[sort.key] ?? "");
    const bv = String(b[sort.key] ?? "");
    let cmp: number;
    if (colType === "amount") {
      cmp = (parseFloat(av.replace(/,/g, "")) || 0) - (parseFloat(bv.replace(/,/g, "")) || 0);
    } else {
      cmp = av.localeCompare(bv, undefined, { sensitivity: "base", numeric: true });
    }
    return sort.dir === "asc" ? cmp : -cmp;
  });
}

interface TableStateInternal {
  filters: Record<string, FilterValue>;
  sort: SortState | null;
  activeKeys: string[];
}

const DEFAULT_STATE: TableStateInternal = { filters: {}, sort: null, activeKeys: [] };

export function useTableState<T extends Record<string, unknown>>(
  rows: T[],
  colDefs: ColDef[],
  storageKey: string,
) {
  const [state, setState] = useState<TableStateInternal>(() => {
    if (typeof window === "undefined") return DEFAULT_STATE;
    try {
      const saved = localStorage.getItem(`table_state_${storageKey}`);
      if (saved) return JSON.parse(saved) as TableStateInternal;
    } catch {}
    return DEFAULT_STATE;
  });

  useEffect(() => {
    try { localStorage.setItem(`table_state_${storageKey}`, JSON.stringify(state)); } catch {}
  }, [state, storageKey]);

  const colDefMap = useMemo(
    () => Object.fromEntries(colDefs.map((c) => [c.key, c])),
    [colDefs],
  );

  const distinctValues = useMemo<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    for (const col of colDefs) {
      if (col.type === "select") {
        out[col.key] = col.options ?? Array.from(
          new Set(rows.map((r) => String(r[col.key] ?? "")).filter(Boolean))
        ).sort();
      }
    }
    return out;
  }, [rows, colDefs]);

  const filteredRows = useMemo(() => {
    let result = rows;
    for (const [key, filter] of Object.entries(state.filters)) {
      if (!isFilterActive(filter)) continue;
      result = result.filter((row) => matchesFilter(row[key], filter));
    }
    if (state.sort) {
      const col = colDefMap[state.sort.key];
      if (col) result = applySortRows(result, state.sort, col.type);
    }
    return result;
  }, [rows, state, colDefMap]);

  // Toggle asc ↔ desc on same key; set asc on new key
  const setSort = useCallback((key: string) => {
    setState((prev) => {
      if (prev.sort?.key === key) {
        return { ...prev, sort: { key, dir: prev.sort.dir === "asc" ? "desc" : "asc" } };
      }
      return { ...prev, sort: { key, dir: "asc" } };
    });
  }, []);

  const clearSort = useCallback(() => setState((prev) => ({ ...prev, sort: null })), []);

  const setFilter = useCallback((key: string, value: FilterValue | null) => {
    setState((prev) => {
      const filters = { ...prev.filters };
      if (value === null) delete filters[key]; else filters[key] = value;
      return { ...prev, filters };
    });
  }, []);

  const toggleActive = useCallback((key: string) => {
    setState((prev) => {
      const had = prev.activeKeys.includes(key);
      const activeKeys = had ? prev.activeKeys.filter((k) => k !== key) : [...prev.activeKeys, key];
      const filters = { ...prev.filters };
      if (had) delete filters[key];
      return { ...prev, activeKeys, filters };
    });
  }, []);

  const clearAll = useCallback(() => setState(DEFAULT_STATE), []);

  const activeCount = Object.entries(state.filters).filter(([, v]) => isFilterActive(v)).length;

  return {
    filteredRows,
    filters: state.filters,
    sort: state.sort,
    activeKeys: state.activeKeys,
    distinctValues,
    setFilter,
    setSort,
    clearSort,
    toggleActive,
    clearAll,
    totalCount: rows.length,
    filteredCount: filteredRows.length,
    activeCount,
  };
}
