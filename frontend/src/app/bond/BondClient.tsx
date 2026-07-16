"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect, useMemo } from "react";
import { usePolling } from "@/lib/usePolling";
import InlineFilters from "@/components/InlineFilters";
import { useTableState, ColDef } from "@/components/useTableState";
import { exportToExcel } from "@/lib/exportExcel";
import { applyColumnOrder, useColumnOrder } from "@/lib/columnOrder";
import { useDensity } from "@/components/DensityContext";

export const BOND_COL_DEFS_BASE: ColDef[] = [
  { key: "supplier_name",   label: "Supplier",                  type: "text"   },
  { key: "supplier_code",   label: "Supp. Code",                type: "text"   },
  { key: "pi_number",       label: "PI Number",                 type: "text"   },
  { key: "rocket_item_code",label: "Rocket Item Code",          type: "text"   },
  { key: "pi_quantity",     label: "Original Quantity",         type: "amount" },
  { key: "exbond_used",     label: "Exbond Quantity",           type: "amount" },
  { key: "remaining_calc",  label: "Remaining Inbond Quantity",  type: "amount" },
];

// remaining_calc is a client-side computed column (not a real row field), kept
// trailing so it stays aligned with the filter row (no filter def for it).
export const BOND_COLS_BASE = [
  { key: "supplier_name", label: "Supplier" },
  { key: "supplier_code", label: "Supp. Code" },
  { key: "pi_number", label: "PI Number" },
  { key: "rocket_item_code", label: "Rocket Item Code" },
  { key: "pi_quantity", label: "Original Quantity" },
  { key: "exbond_used", label: "Exbond Quantity" },
  { key: "remaining_calc", label: "Remaining Inbond Quantity" },
];

interface Row {
  id: number; uid: string;
  supplier_name: string | null; supplier_code: string | null;
  pi_number: string | null; rocket_item_code: string | null;
  pi_quantity: string | null; exbond_used: string | null;
  [key: string]: string | null | number | boolean;
}

interface BondItem {
  model_number: string;
  quantity: string;
  rate: string | null;
  exbond_used: string | null;
  remaining: string;
}

const COPY_AS_IS_FIELDS = [
  "srno", "date_of_po", "supplier_name", "rocket_item_code", "supplier_code",
  "po_number", "po_rate", "pi_number", "pi_date", "supplier_model_number",
  "pi_rate", "tentative_exworks_at_po_time", "confirmed_exworks", "credit_time",
  "currency", "exchange_rate", "boe_no",
];
const PRORATE_FIELDS = ["po_quantity", "po_total_value", "pi_total_value", "actual_boe"];

function computeRemaining(row: Row): number {
  const original = parseFloat(row.pi_quantity ?? "0") || 0;
  const used = parseFloat(row.exbond_used ?? "0") || 0;
  return original - used;
}

const btnStyle = (v: "primary" | "ghost" | "action"): React.CSSProperties => ({
  padding: "5px 12px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
  fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid", whiteSpace: "nowrap",
  ...(v === "primary" ? { background: "#09090b", color: "#fff", borderColor: "#09090b" } :
     v === "action"   ? { background: "#f4f4f5", color: "#09090b", borderColor: "#e4e4e7" } :
                         { background: "transparent", color: "#71717a", borderColor: "#e4e4e7" }),
});

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: "7px", border: "1px solid #e4e4e7",
  fontSize: "13px", fontFamily: "var(--font-sans), sans-serif", outline: "none", background: "#fafafa",
};

export default function BondClient({ initialRows }: { initialRows: Row[] }) {
  const { compact } = useDensity();
  const TH: React.CSSProperties = { padding: compact ? "4px 8px" : "10px 14px", textAlign: "left", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b", background: "#fafafa", borderBottom: "1px solid #b8b8bf", whiteSpace: "nowrap" };
  const TD: React.CSSProperties = { padding: compact ? "3px 8px" : "9px 14px", fontSize: "13px", borderBottom: "1px solid #d4d4d8", color: "#09090b", whiteSpace: "nowrap" };
  const [rows, setRows] = useState<Row[]>(initialRows);
  const columnOrder = useColumnOrder("bond");
  const BOND_COL_DEFS = useMemo(() => applyColumnOrder(BOND_COL_DEFS_BASE, columnOrder), [columnOrder]);
  const BOND_COLS = useMemo(() => applyColumnOrder(BOND_COLS_BASE, columnOrder), [columnOrder]);
  const { filteredRows, filters, sort, distinctValues, setFilter, setSort } =
    useTableState(rows as unknown as Record<string, unknown>[], BOND_COL_DEFS, "bond");

  async function fetchRows() {
    const res = await apiFetch(`${API}/api/rows/stage/bond`);
    if (res.ok) setRows(await res.json());
  }
  useEffect(() => { fetchRows(); }, []);
  usePolling(fetchRows, 10_000);

  const [exbondModal, setExbondModal] = useState<Row | null>(null);
  const [exbondBoeNo, setExbondBoeNo] = useState("");
  // per-model quantities being taken in this exbond, parallel to bondItems
  const [bondItems, setBondItems] = useState<BondItem[]>([]);
  const [takes, setTakes] = useState<string[]>([]);
  const [exbondError, setExbondError] = useState<string | null>(null);
  const [exbondSaving, setExbondSaving] = useState(false);

  async function openExbondModal(row: Row) {
    setExbondModal(row);
    setExbondBoeNo("");
    setBondItems([]);
    setTakes([]);
    setExbondError(null);
    const res = await apiFetch(`${API}/api/rows/${row.uid}/bond-items`);
    const data: BondItem[] = res.ok ? await res.json() : [];
    setBondItems(data);
    setTakes(data.map(() => ""));
  }

  async function handleBackToBoe(uid: string) {
    await apiFetch(`${API}/api/rows/${uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_status: "boe" }),
    });
    setRows((r) => r.filter((row) => row.uid !== uid));
  }

  async function handleSubmitExbond() {
    if (!exbondModal) return;
    if (!exbondBoeNo.trim()) {
      setExbondError("Exbond BOE Number is required.");
      return;
    }
    const totalTake = takes.reduce((sum, t) => sum + (parseFloat(t) || 0), 0);
    if (totalTake <= 0) {
      setExbondError("Enter an exbond quantity for at least one model.");
      return;
    }
    for (let i = 0; i < bondItems.length; i++) {
      const take = parseFloat(takes[i]) || 0;
      const rem = parseFloat(bondItems[i].remaining) || 0;
      if (take < 0 || take > rem + 0.0001) {
        setExbondError(`${bondItems[i].model_number || "Item"}: quantity must be no more than the remaining ${rem.toFixed(2)}.`);
        return;
      }
    }
    setExbondSaving(true);
    setExbondError(null);

    const originalQty = parseFloat(exbondModal.pi_quantity ?? "0") || 0;
    const share = originalQty > 0 ? totalTake / originalQty : 0;

    const items = bondItems
      .map((it, i) => ({ model_number: it.model_number, quantity: String(parseFloat(takes[i]) || 0), rate: it.rate ?? "" }))
      .filter((it) => parseFloat(it.quantity) > 0 && it.model_number.trim() !== "");

    const body: Record<string, unknown> = {
      workflow_status: "transportation",
      bond_parent_uid: exbondModal.uid,
      exbond_boe_no: exbondBoeNo.trim(),
      exbond_quantity: String(totalTake),
      pi_quantity: String(totalTake),
    };
    if (items.length > 0) body.items = items;
    for (const f of COPY_AS_IS_FIELDS) {
      const v = exbondModal[f];
      if (v !== null && v !== undefined && String(v).trim() !== "") body[f] = String(v);
    }
    // prorated fallbacks by quantity share; when items carry rates the server
    // recomputes pi_total_value exactly from the taken items
    for (const f of PRORATE_FIELDS) {
      const raw = parseFloat((exbondModal[f] as string) ?? "");
      if (!isNaN(raw)) body[f] = String(parseFloat((raw * share).toFixed(4)));
    }

    const res = await apiFetch(`${API}/api/rows/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) {
      const newRemaining = computeRemaining(exbondModal) - totalTake;
      if (newRemaining <= 0.0001) {
        await apiFetch(`${API}/api/rows/${exbondModal.uid}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflow_status: "complete" }),
        });
      }
      setExbondModal(null);
      fetchRows();
    } else {
      setExbondError("Failed to save the exbond split. Please try again.");
    }
    setExbondSaving(false);
  }

  const totalTakePreview = takes.reduce((sum, t) => sum + (parseFloat(t) || 0), 0);
  const previewRemaining = exbondModal ? computeRemaining(exbondModal) - totalTakePreview : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b", margin: 0 }}>Bond</h1>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa", textTransform: "uppercase" }}>{rows.length} rows</span>
          <button style={btnStyle("ghost")} onClick={() => exportToExcel(filteredRows, "bond", Object.fromEntries(BOND_COLS.map(c => [c.key, c.label])))}>↓ Export</button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th style={TH}>#</th>
              {BOND_COLS.map((c) => {
                const isSorted = sort?.key === c.key;
                return (
                  <th key={c.key} style={{ ...TH, cursor: "pointer", userSelect: "none" }} onClick={() => setSort(c.key)}>
                    {c.label}
                    <span style={{ marginLeft: "4px", fontSize: "9px", display: "inline-flex", flexDirection: "column", lineHeight: "9px", verticalAlign: "middle", gap: "1px" }}>
                      <span style={{ color: isSorted && sort?.dir === "asc" ? "#09090b" : "#d4d4d8" }}>▲</span>
                      <span style={{ color: isSorted && sort?.dir === "desc" ? "#09090b" : "#d4d4d8" }}>▼</span>
                    </span>
                  </th>
                );
              })}
              <th style={{ ...TH, textAlign: "right" }}>Actions</th>
            </tr>
            <InlineFilters colDefs={BOND_COL_DEFS} filters={filters} distinctValues={distinctValues} onFilter={setFilter} leadingCells={1} trailingCells={2} />
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={BOND_COLS.length + 2} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>{rows.length === 0 ? "No rows in Bond stage" : "No results match filters"}</td></tr>
            ) : (filteredRows as Row[]).map((row, i) => {
              const remaining = computeRemaining(row);
              return (
                <tr key={row.uid}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>{String(i + 1).padStart(3, "0")}</td>
                  {BOND_COLS.map((col) => {
                    if (col.key === "remaining_calc") return <td key="remaining_calc" style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontWeight: 600 }}>{remaining.toFixed(2)}</td>;
                    if (col.key === "exbond_used") return <td key="exbond_used" style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.exbond_used ?? "0"}</td>;
                    const v = String(row[col.key] ?? "");
                    const mono = col.key !== "supplier_name";
                    return <td key={col.key} style={{ ...TD, fontFamily: mono ? "var(--font-mono), monospace" : undefined }}>{v || <span style={{ color: "#d4d4d8" }}>—</span>}</td>;
                  })}
                  <td style={{ ...TD, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button style={btnStyle("ghost")} onClick={() => handleBackToBoe(row.uid)}>← BOE</button>
                      <button style={{ ...btnStyle("primary"), ...(remaining <= 0 ? { opacity: 0.4, cursor: "not-allowed" } : {}) }}
                        onClick={() => { if (remaining <= 0) return; openExbondModal(row); }}>
                        Exbond
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Exbond modal */}
      {exbondModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmitExbond(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "420px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>Exbond</h2>
              <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa", fontFamily: "var(--font-sans), sans-serif" }}>
                PI {exbondModal.pi_number ?? "—"} — <strong style={{ color: "#52525b" }}>{exbondModal.supplier_name}</strong>
              </p>
            </div>

            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
              Exbond BOE Number
              <input style={inputStyle} value={exbondBoeNo} onChange={(e) => setExbondBoeNo(e.target.value)} />
            </label>

            {/* per-model exbond quantities */}
            <div style={{ border: "1px solid #e4e4e7", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px", background: "#fafafa" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono), monospace" }}>
                Exbond Quantity (per model)
              </span>
              {bondItems.length === 0 ? (
                <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa" }}>Loading…</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "6px", alignItems: "center" }}>
                  {["Model No", "Remaining", "Take"].map((h) => (
                    <span key={h} style={{ fontSize: "10px", fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                  ))}
                  {bondItems.map((it, i) => (
                    <div key={`${it.model_number}-${i}`} style={{ display: "contents" }}>
                      <span style={{ fontSize: "12px", fontFamily: "var(--font-mono), monospace" }}>{it.model_number || "—"}</span>
                      <span style={{ fontSize: "12px", fontFamily: "var(--font-mono), monospace", color: "#52525b" }}>{parseFloat(it.remaining).toFixed(2)}</span>
                      <input style={{ ...inputStyle, padding: "5px 8px", fontSize: "12px" }} type="text" inputMode="decimal"
                        placeholder="0" value={takes[i] ?? ""}
                        onChange={(e) => setTakes((ts) => ts.map((t, j) => (j === i ? e.target.value : t)))} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ fontSize: "12px", fontFamily: "var(--font-mono), monospace", color: "#52525b", display: "flex", flexDirection: "column", gap: "2px" }}>
              <span>Taking now (all models): {totalTakePreview.toFixed(2)}</span>
              <span>Currently remaining: {computeRemaining(exbondModal).toFixed(2)}</span>
              <span style={{ fontWeight: 600, color: previewRemaining < 0 ? "#ef4444" : "#09090b" }}>
                Remaining after this split: {previewRemaining.toFixed(2)}
              </span>
            </div>

            {exbondError && <p style={{ margin: 0, fontSize: "12px", color: "#ef4444" }}>{exbondError}</p>}

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => setExbondModal(null)}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleSubmitExbond} disabled={exbondSaving}>{exbondSaving ? "Saving…" : "Exbond & Go to Transportation →"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
