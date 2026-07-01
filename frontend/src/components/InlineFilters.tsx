"use client";
import { useState, useRef, useEffect } from "react";
import {
  ColDef, FilterValue, DateMode,
  TextFilter, DateFilter, AmountFilter, SelectFilter,
} from "./useTableState";

const inp: React.CSSProperties = {
  padding: "3px 6px", borderRadius: "5px", border: "1px solid #e4e4e7",
  fontSize: "11px", fontFamily: "var(--font-sans), sans-serif",
  outline: "none", background: "#fff", color: "#09090b", width: "100%", boxSizing: "border-box",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_VALS = ["01","02","03","04","05","06","07","08","09","10","11","12"];

const DATE_MODE_LABELS: { value: DateMode; label: string }[] = [
  { value: "exact",       label: "Exact" },
  { value: "week",        label: "Week" },
  { value: "month",       label: "Month" },
  { value: "year",        label: "Year" },
  { value: "range",       label: "Range" },
  { value: "month_range", label: "Mth Rng" },
];

function MSelect({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ ...inp, padding: "3px 4px" }}>
      <option value="">{placeholder}</option>
      {MONTH_VALS.map((m, i) => <option key={m} value={m}>{MONTHS[i]}</option>)}
    </select>
  );
}

function TextCell({ col, f, onFilter }: { col: ColDef; f: TextFilter | undefined; onFilter: (k: string, v: FilterValue | null) => void }) {
  return (
    <div style={{ position: "relative" }}>
      <input
        type="text" placeholder="search…"
        value={f?.value ?? ""}
        onChange={(e) => onFilter(col.key, { mode: "text", value: e.target.value })}
        style={inp}
      />
      {f?.value && (
        <button onClick={() => onFilter(col.key, null)}
          style={{ position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#a1a1aa", fontSize: "13px", lineHeight: 1, padding: 0 }}>
          ×
        </button>
      )}
    </div>
  );
}

function AmountCell({ col, f, onFilter }: { col: ColDef; f: AmountFilter | undefined; onFilter: (k: string, v: FilterValue | null) => void }) {
  const min = f?.min ?? ""; const max = f?.max ?? "";
  const upd = (patch: Partial<AmountFilter>) => onFilter(col.key, { mode: "amount", min, max, ...patch });
  const hasSome = !!(min || max);
  return (
    <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
      <input type="text" inputMode="decimal" placeholder="min" value={min}
        onChange={(e) => upd({ min: e.target.value })}
        style={{ ...inp, width: "48px" }} />
      <span style={{ color: "#a1a1aa", fontSize: "10px", flexShrink: 0 }}>–</span>
      <input type="text" inputMode="decimal" placeholder="max" value={max}
        onChange={(e) => upd({ max: e.target.value })}
        style={{ ...inp, width: "48px" }} />
      {hasSome && (
        <button onClick={() => onFilter(col.key, null)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#a1a1aa", fontSize: "13px", lineHeight: 1, padding: "0 1px", flexShrink: 0 }}>
          ×
        </button>
      )}
    </div>
  );
}

function DateCell({ col, f, onFilter }: { col: ColDef; f: DateFilter | undefined; onFilter: (k: string, v: FilterValue | null) => void }) {
  const dm = f?.dateMode ?? "exact";
  const upd = (patch: Partial<DateFilter>) =>
    onFilter(col.key, { mode: "date", dateMode: dm, ...f, ...patch } as DateFilter);
  const hasValue = !!(f?.exact || f?.from || f?.to || f?.year || f?.month || f?.fromYear || f?.fromMonth || f?.toYear || f?.toMonth);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: "110px" }}>
      <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
        <select value={dm} onChange={(e) => onFilter(col.key, { mode: "date", dateMode: e.target.value as DateMode })}
          style={{ ...inp, padding: "3px 4px", flex: 1 }}>
          {DATE_MODE_LABELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {hasValue && (
          <button onClick={() => onFilter(col.key, null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#a1a1aa", fontSize: "13px", lineHeight: 1, padding: "0 1px", flexShrink: 0 }}>
            ×
          </button>
        )}
      </div>

      {dm === "exact" && (
        <input type="date" value={f?.exact ?? ""} onChange={(e) => upd({ exact: e.target.value })} style={inp} />
      )}
      {dm === "week" && (
        <input type="date" value={f?.from ?? ""} onChange={(e) => upd({ from: e.target.value })} style={inp} title="Any date in that week" />
      )}
      {dm === "month" && (
        <div style={{ display: "flex", gap: "2px" }}>
          <MSelect value={f?.month ?? ""} placeholder="M" onChange={(v) => upd({ month: v })} />
          <input type="number" placeholder="YYYY" value={f?.year ?? ""} onChange={(e) => upd({ year: e.target.value })}
            style={{ ...inp, width: "54px" }} />
        </div>
      )}
      {dm === "year" && (
        <input type="number" placeholder="YYYY" value={f?.year ?? ""}
          onChange={(e) => upd({ year: e.target.value })} style={inp} />
      )}
      {dm === "range" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <input type="date" value={f?.from ?? ""} onChange={(e) => upd({ from: e.target.value })} style={inp} />
          <input type="date" value={f?.to ?? ""} onChange={(e) => upd({ to: e.target.value })} style={inp} />
        </div>
      )}
      {dm === "month_range" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ display: "flex", gap: "2px" }}>
            <MSelect value={f?.fromMonth ?? ""} placeholder="M" onChange={(v) => upd({ fromMonth: v })} />
            <input type="number" placeholder="YY" value={f?.fromYear ?? ""} onChange={(e) => upd({ fromYear: e.target.value })}
              style={{ ...inp, width: "44px" }} />
          </div>
          <div style={{ display: "flex", gap: "2px" }}>
            <MSelect value={f?.toMonth ?? ""} placeholder="M" onChange={(v) => upd({ toMonth: v })} />
            <input type="number" placeholder="YY" value={f?.toYear ?? ""} onChange={(e) => upd({ toYear: e.target.value })}
              style={{ ...inp, width: "44px" }} />
          </div>
        </div>
      )}
    </div>
  );
}

function SelectCell({ col, f, options, onFilter }: {
  col: ColDef; f: SelectFilter | undefined; options: string[];
  onFilter: (k: string, v: FilterValue | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = new Set(f?.values ?? []);
  const allChecked = options.length > 0 && selected.size === options.length;
  const noneSelected = selected.size === 0;

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  const toggle = (opt: string) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt); else next.add(opt);
    onFilter(col.key, next.size === 0 ? null : { mode: "select", values: Array.from(next) });
  };

  const label = noneSelected ? "All ▾" : `${selected.size} sel ▾`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)}
        style={{ ...inp, cursor: "pointer", textAlign: "left", whiteSpace: "nowrap",
          background: noneSelected ? "#fff" : "#09090b",
          color: noneSelected ? "#71717a" : "#fff",
          border: `1px solid ${noneSelected ? "#e4e4e7" : "#09090b"}` }}>
        {label}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 2px)", left: 0, zIndex: 100,
          background: "#fff", border: "1px solid #e4e4e7", borderRadius: "7px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)", padding: "6px 8px",
          minWidth: "140px", maxHeight: "200px", overflowY: "auto",
          display: "flex", flexDirection: "column", gap: "3px",
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "11px",
            paddingBottom: "4px", borderBottom: "1px solid #f4f4f5", marginBottom: "2px" }}>
            <input type="checkbox" checked={allChecked}
              onChange={() => onFilter(col.key, allChecked ? null : { mode: "select", values: [...options] })} />
            <span style={{ color: "#a1a1aa", fontStyle: "italic" }}>All</span>
          </label>
          {options.map((opt) => (
            <label key={opt} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "11px", color: "#09090b" }}>
              <input type="checkbox" checked={selected.has(opt)} onChange={() => toggle(opt)} />
              {opt || <span style={{ color: "#d4d4d8" }}>—</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

interface InlineFiltersProps {
  colDefs: ColDef[];
  filters: Record<string, FilterValue>;
  distinctValues: Record<string, string[]>;
  onFilter: (key: string, value: FilterValue | null) => void;
  leadingCells?: number;
  trailingCells?: number;
  baseThStyle?: React.CSSProperties;
}

export default function InlineFilters({
  colDefs, filters, distinctValues, onFilter,
  leadingCells = 0, trailingCells = 0, baseThStyle,
}: InlineFiltersProps) {
  const cellStyle: React.CSSProperties = {
    padding: "5px 8px", background: "#fff",
    borderBottom: "1px solid #e4e4e7", borderRight: "1px solid #f4f4f5",
    verticalAlign: "top",
    ...baseThStyle,
  };

  return (
    <tr>
      {Array.from({ length: leadingCells }).map((_, i) => (
        <th key={`lead-${i}`} style={cellStyle} />
      ))}
      {colDefs.map((col) => {
        const f = filters[col.key];
        const opts = distinctValues[col.key] ?? col.options ?? [];
        return (
          <th key={col.key} style={cellStyle}>
            {col.type === "text"   && <TextCell   col={col} f={f as TextFilter}   onFilter={onFilter} />}
            {col.type === "amount" && <AmountCell col={col} f={f as AmountFilter} onFilter={onFilter} />}
            {col.type === "date"   && <DateCell   col={col} f={f as DateFilter}   onFilter={onFilter} />}
            {col.type === "select" && <SelectCell col={col} f={f as SelectFilter} options={opts} onFilter={onFilter} />}
          </th>
        );
      })}
      {Array.from({ length: trailingCells }).map((_, i) => (
        <th key={`trail-${i}`} style={cellStyle} />
      ))}
    </tr>
  );
}
