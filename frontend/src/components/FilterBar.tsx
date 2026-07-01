"use client";
import { ColDef, FilterValue, SortState, DateMode, TextFilter, DateFilter, AmountFilter, SelectFilter } from "./useTableState";

interface Props {
  colDefs: ColDef[];
  filters: Record<string, FilterValue>;
  sort: SortState | null;
  activeKeys: string[];
  distinctValues: Record<string, string[]>;
  totalCount: number;
  filteredCount: number;
  onFilter: (key: string, value: FilterValue | null) => void;
  onSort: (key: string) => void;
  onClearSort: () => void;
  onToggleActive: (key: string) => void;
  onClearAll: () => void;
}

const DATE_MODES: { value: DateMode; label: string }[] = [
  { value: "exact",       label: "Exact" },
  { value: "week",        label: "Week" },
  { value: "month",       label: "Month" },
  { value: "year",        label: "Year" },
  { value: "range",       label: "Date Range" },
  { value: "month_range", label: "Month Range" },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_VALS = ["01","02","03","04","05","06","07","08","09","10","11","12"];

const inputCss: React.CSSProperties = {
  padding: "5px 8px", borderRadius: "6px", border: "1px solid #e4e4e7",
  fontSize: "12px", fontFamily: "var(--font-sans), sans-serif",
  outline: "none", background: "#fff", color: "#09090b",
};

function MonthSelect({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputCss }}>
      <option value="">{placeholder}</option>
      {MONTH_VALS.map((m, i) => <option key={m} value={m}>{MONTHS[i]}</option>)}
    </select>
  );
}

function TextFilterBody({ f, onChange }: { f: TextFilter | undefined; onChange: (v: TextFilter) => void }) {
  return (
    <input type="text" placeholder="contains…" value={f?.value ?? ""}
      onChange={(e) => onChange({ mode: "text", value: e.target.value })}
      style={{ ...inputCss, width: "100%" }} />
  );
}

function AmountFilterBody({ f, onChange }: { f: AmountFilter | undefined; onChange: (v: AmountFilter) => void }) {
  const min = f?.min ?? ""; const max = f?.max ?? "";
  return (
    <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
      <span style={{ fontSize: "11px", color: "#71717a" }}>≥</span>
      <input type="text" inputMode="decimal" placeholder="Min" value={min}
        onChange={(e) => onChange({ mode: "amount", min: e.target.value, max })}
        style={{ ...inputCss, width: "72px" }} />
      <span style={{ fontSize: "11px", color: "#71717a" }}>≤</span>
      <input type="text" inputMode="decimal" placeholder="Max" value={max}
        onChange={(e) => onChange({ mode: "amount", min, max: e.target.value })}
        style={{ ...inputCss, width: "72px" }} />
    </div>
  );
}

function DateFilterBody({ f, onChange }: { f: DateFilter | undefined; onChange: (v: DateFilter) => void }) {
  const dm = f?.dateMode ?? "exact";
  const upd = (patch: Partial<DateFilter>) => onChange({ mode: "date", dateMode: dm, ...f, ...patch } as DateFilter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
      <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
        {DATE_MODES.map((m) => (
          <button key={m.value} onClick={() => onChange({ mode: "date", dateMode: m.value })}
            style={{ padding: "2px 7px", borderRadius: "4px", fontSize: "10px", cursor: "pointer", border: `1px solid ${dm === m.value ? "#09090b" : "#e4e4e7"}`, background: dm === m.value ? "#09090b" : "transparent", color: dm === m.value ? "#fff" : "#71717a", fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>
            {m.label}
          </button>
        ))}
      </div>

      {dm === "exact" && (
        <input type="date" value={f?.exact ?? ""} onChange={(e) => upd({ exact: e.target.value })} style={inputCss} />
      )}
      {dm === "week" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <span style={{ fontSize: "10px", color: "#71717a" }}>Any date in that week:</span>
          <input type="date" value={f?.from ?? ""} onChange={(e) => upd({ from: e.target.value })} style={inputCss} />
        </div>
      )}
      {dm === "month" && (
        <div style={{ display: "flex", gap: "5px" }}>
          <MonthSelect value={f?.month ?? ""} placeholder="Month" onChange={(v) => upd({ month: v })} />
          <input type="number" placeholder="YYYY" value={f?.year ?? ""} onChange={(e) => upd({ year: e.target.value })} style={{ ...inputCss, width: "65px" }} />
        </div>
      )}
      {dm === "year" && (
        <input type="number" placeholder="Year e.g. 2025" value={f?.year ?? ""}
          onChange={(e) => upd({ year: e.target.value })} style={{ ...inputCss, width: "130px" }} />
      )}
      {dm === "range" && (
        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
          <input type="date" value={f?.from ?? ""} onChange={(e) => upd({ from: e.target.value })} style={inputCss} />
          <span style={{ fontSize: "11px", color: "#a1a1aa" }}>–</span>
          <input type="date" value={f?.to ?? ""} onChange={(e) => upd({ to: e.target.value })} style={inputCss} />
        </div>
      )}
      {dm === "month_range" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <MonthSelect value={f?.fromMonth ?? ""} placeholder="From M" onChange={(v) => upd({ fromMonth: v })} />
            <input type="number" placeholder="YYYY" value={f?.fromYear ?? ""} onChange={(e) => upd({ fromYear: e.target.value })} style={{ ...inputCss, width: "60px" }} />
          </div>
          <span style={{ fontSize: "10px", color: "#a1a1aa", paddingLeft: "2px" }}>to</span>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <MonthSelect value={f?.toMonth ?? ""} placeholder="To M" onChange={(v) => upd({ toMonth: v })} />
            <input type="number" placeholder="YYYY" value={f?.toYear ?? ""} onChange={(e) => upd({ toYear: e.target.value })} style={{ ...inputCss, width: "60px" }} />
          </div>
        </div>
      )}
    </div>
  );
}

function SelectFilterBody({ f, options, onChange }: { f: SelectFilter | undefined; options: string[]; onChange: (v: SelectFilter) => void }) {
  const selected = new Set(f?.values ?? []);
  const allChecked = options.length > 0 && selected.size === options.length;
  const toggle = (opt: string) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt); else next.add(opt);
    onChange({ mode: "select", values: Array.from(next) });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px", maxHeight: "140px", overflowY: "auto" }}>
      <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "12px", paddingBottom: "3px", borderBottom: "1px solid #f4f4f5" }}>
        <input type="checkbox" checked={allChecked} onChange={() => onChange({ mode: "select", values: allChecked ? [] : [...options] })} />
        <span style={{ color: "#a1a1aa", fontStyle: "italic" }}>All</span>
      </label>
      {options.map((opt) => (
        <label key={opt} style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "12px", color: "#09090b" }}>
          <input type="checkbox" checked={selected.has(opt)} onChange={() => toggle(opt)} />
          {opt || <span style={{ color: "#d4d4d8" }}>—</span>}
        </label>
      ))}
      {options.length === 0 && <span style={{ fontSize: "11px", color: "#a1a1aa", fontStyle: "italic" }}>No values</span>}
    </div>
  );
}

function FilterCard({ colKey, colDef, filter, options, onFilter, onRemove }: {
  colKey: string; colDef: ColDef; filter: FilterValue | undefined;
  options: string[]; onFilter: (k: string, v: FilterValue | null) => void; onRemove: () => void;
}) {
  return (
    <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "8px 10px", background: "#fff", minWidth: "180px", maxWidth: "300px", flex: "0 0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "#09090b", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "var(--font-sans), sans-serif" }}>
          {colDef.label}
        </span>
        <button onClick={onRemove} title="Remove filter"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#a1a1aa", fontSize: "15px", lineHeight: 1, padding: "0 2px" }}>×</button>
      </div>
      {colDef.type === "text"   && <TextFilterBody   f={filter as TextFilter}   onChange={(v) => onFilter(colKey, v)} />}
      {colDef.type === "amount" && <AmountFilterBody f={filter as AmountFilter} onChange={(v) => onFilter(colKey, v)} />}
      {colDef.type === "date"   && <DateFilterBody   f={filter as DateFilter}   onChange={(v) => onFilter(colKey, v)} />}
      {colDef.type === "select" && <SelectFilterBody f={filter as SelectFilter} options={options} onChange={(v) => onFilter(colKey, v)} />}
    </div>
  );
}

export default function FilterBar({
  colDefs, filters, sort, activeKeys, distinctValues,
  totalCount, filteredCount, onFilter, onSort, onClearSort, onToggleActive, onClearAll,
}: Props) {
  const hasAny = activeKeys.length > 0 || !!sort;
  const availableCols = colDefs.filter((c) => !activeKeys.includes(c.key));
  const isFiltered = filteredCount < totalCount;

  return (
    <div style={{ border: "1px solid #e4e4e7", borderRadius: "10px", padding: "10px 14px", background: "#fafafa", display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Control row */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        {/* Add filter dropdown */}
        <select value="" onChange={(e) => { if (e.target.value) onToggleActive(e.target.value); }}
          style={{ ...inputCss, fontSize: "11px", cursor: "pointer" }}>
          <option value="">+ Filter column…</option>
          {availableCols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>

        {/* Sort section */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <select
            value={sort?.key ?? ""}
            onChange={(e) => {
              const key = e.target.value;
              if (!key) { onClearSort(); return; }
              if (key !== sort?.key) onSort(key);
            }}
            style={{ ...inputCss, fontSize: "11px", cursor: "pointer" }}>
            <option value="">Sort by…</option>
            {colDefs.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          {sort && (
            <>
              <button onClick={() => onSort(sort.key)} title="Toggle direction"
                style={{ ...inputCss, padding: "4px 8px", cursor: "pointer", fontFamily: "var(--font-mono), monospace", fontSize: "11px", background: "#09090b", color: "#fff", border: "1px solid #09090b" }}>
                {sort.dir === "asc" ? "▲" : "▼"} {sort.dir === "asc" ? "Asc" : "Desc"}
              </button>
              <button onClick={onClearSort} title="Clear sort"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#a1a1aa", fontSize: "14px", padding: "0 2px" }}>×</button>
            </>
          )}
        </div>

        {/* Row counter */}
        <span style={{ marginLeft: "auto", fontSize: "12px", fontFamily: "var(--font-mono), monospace", color: isFiltered ? "#09090b" : "#a1a1aa" }}>
          {isFiltered ? <><strong>{filteredCount}</strong><span style={{ color: "#a1a1aa" }}> / {totalCount}</span></> : `${totalCount} rows`}
        </span>

        {hasAny && (
          <button onClick={onClearAll}
            style={{ ...inputCss, cursor: "pointer", fontSize: "11px", padding: "4px 9px", color: "#71717a" }}>
            Clear all ×
          </button>
        )}
      </div>

      {/* Active filter cards */}
      {activeKeys.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {activeKeys.map((key) => {
            const def = colDefs.find((c) => c.key === key);
            if (!def) return null;
            return (
              <FilterCard
                key={key} colKey={key} colDef={def} filter={filters[key]}
                options={distinctValues[key] ?? def.options ?? []}
                onFilter={onFilter} onRemove={() => onToggleActive(key)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
