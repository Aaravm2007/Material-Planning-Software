"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect, useMemo } from "react";
import { usePolling } from "@/lib/usePolling";
import InlineFilters from "@/components/InlineFilters";
import { useTableState, ColDef } from "@/components/useTableState";
import { exportToExcel } from "@/lib/exportExcel";
import AmountInput from "@/components/AmountInput";
import { applyColumnOrder, useColumnOrder } from "@/lib/columnOrder";
import { useDensity } from "@/components/DensityContext";

const ENTRY_CCY_OPTIONS = ["INR", "USD", "EUR", "CNY", "GBP", "AED"];

export const BOE_FILTER_DEFS_BASE: ColDef[] = [
  { key: "supplier_name",  label: "Supplier",         type: "text"   },
  { key: "supplier_code",  label: "Supp. Code",       type: "text"   },
  { key: "pi_number",      label: "PI Number",        type: "text"   },
  { key: "boe_no",         label: "BOE No",           type: "text"   },
  { key: "customs_rate",   label: "Customs Rate (%)", type: "amount" },
  { key: "actual_boe",     label: "Actual BOE",       type: "amount" },
  { key: "actual_boe_inr", label: "Actual BOE (INR)", type: "amount" },
];

// provisional_boe_calc is a client-side computed preview (not a real row field), so it
// carries no filter and is kept as a trailing column to stay aligned with the filter row.
export const BOE_COLS_BASE = [
  { key: "supplier_name", label: "Supplier" },
  { key: "supplier_code", label: "Supp. Code" },
  { key: "pi_number", label: "PI Number" },
  { key: "boe_no", label: "BOE No" },
  { key: "customs_rate", label: "Customs Rate (%)" },
  { key: "actual_boe", label: "Actual BOE (sum)" },
  { key: "actual_boe_inr", label: "Actual BOE (INR)" },
  { key: "provisional_boe_calc", label: "Provisional BOE (auto)" },
];

interface Row {
  id: number; uid: string;
  po_total_value: string | null; freight_charges: string | null; insurance: string | null;
  pi_total_value: string | null; currency: string | null; exchange_rate: string | null;
  boe_no: string | null;
  provisional_boe: string | null;
  actual_boe: string | null; actual_boe_inr: string | null;
  customs_rate: string | null;
  inbond: string | null;
  fields_entered: boolean | null;
  [key: string]: string | null | number | boolean;
}
interface BoeEntry { id: number; uid: string; amount: string; currency: string | null; rate: string | null; note: string | null; }
interface ShippingOptionRef { freight: string | null; currency: string | null; exchange_rate: string | null; is_selected: boolean; }

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

const readOnlyStyle: React.CSSProperties = { ...inputStyle, background: "#f0f0f0", color: "#52525b" };

function calcProvisional(row: { po_total_value: string | null; freight_charges: string | null; insurance: string | null; customs_rate: string | null }): string {
  const po   = parseFloat(row.po_total_value  ?? "0") || 0;
  const fr   = parseFloat(row.freight_charges ?? "0") || 0;
  const ins  = parseFloat(row.insurance ?? "0") || 0;
  const rate = parseFloat(row.customs_rate ?? "0") || 0;
  const val = (po + fr + ins) * (1 + rate / 100);
  return val > 0 ? val.toFixed(2) : "—";
}

function entryInrValue(e: { amount: string; currency: string | null; rate: string | null }): number {
  const amount = parseFloat(e.amount) || 0;
  if (e.currency && e.currency !== "INR") return amount * (parseFloat(e.rate ?? "") || 0);
  return amount;
}

export default function BoeClient({ initialRows }: { initialRows: Row[] }) {
  const { compact } = useDensity();
  const TH: React.CSSProperties = { padding: compact ? "4px 8px" : "10px 14px", textAlign: "left", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b", background: "#fafafa", borderBottom: "1px solid #b8b8bf", whiteSpace: "nowrap" };
  const TD: React.CSSProperties = { padding: compact ? "3px 8px" : "9px 14px", fontSize: "13px", borderBottom: "1px solid #d4d4d8", color: "#09090b", whiteSpace: "nowrap" };
  const [rows, setRows] = useState<Row[]>(initialRows);
  const columnOrder = useColumnOrder("boe");
  const BOE_FILTER_DEFS = useMemo(() => applyColumnOrder(BOE_FILTER_DEFS_BASE, columnOrder), [columnOrder]);
  const { filteredRows, filters, sort, distinctValues, setFilter, setSort } =
    useTableState(rows as unknown as Record<string, unknown>[], BOE_FILTER_DEFS, "boe");
  async function fetchRows() {
    const res = await apiFetch(`${API}/api/rows/stage/boe`);
    if (res.ok) {
      const data: Row[] = await res.json();
      setRows(data);
      syncProvisionalBoe(data);
    }
  }
  useEffect(() => { fetchRows(); }, []);
  usePolling(fetchRows, 10_000);

  // Persist the auto-computed provisional BOE onto the row so it's visible
  // outside this page (e.g. Master Table), keeping it in sync as the
  // underlying PO total / freight / insurance / customs rate change.
  async function syncProvisionalBoe(rowList: Row[]) {
    for (const row of rowList) {
      const computed = calcProvisional(row);
      if (computed === "—" || row.provisional_boe === computed) continue;
      const res = await apiFetch(`${API}/api/rows/${row.uid}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provisional_boe: computed }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRows((r) => r.map((x) => x.uid === updated.uid ? updated : x));
      }
    }
  }

  const [editModal, setEditModal] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [entries, setEntries] = useState<BoeEntry[]>([]);
  const [newEntry, setNewEntry] = useState({ amount: "", currency: "INR", rate: "", note: "" });
  const [freightRef, setFreightRef] = useState<ShippingOptionRef | null>(null);
  const [saving, setSaving] = useState(false);

  function syncActualBoe(uid: string, entryList: BoeEntry[]) {
    const sum = entryList.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
    const inrSum = entryList.reduce((acc, e) => acc + entryInrValue(e), 0);
    setRows((r) => r.map((row) => {
      if (row.uid !== uid) return row;
      return {
        ...row,
        actual_boe: sum > 0 ? String(sum.toFixed(2)) : "0",
        actual_boe_inr: inrSum > 0 ? String(inrSum.toFixed(2)) : "0",
      };
    }));
  }

  async function openEditModal(row: Row) {
    setEditModal(row);
    setEditForm({
      boe_no: String(row.boe_no ?? ""),
      customs_rate: String(row.customs_rate ?? ""),
    });
    setNewEntry({ amount: "", currency: "INR", rate: "", note: "" });
    setFreightRef(null);
    const [entriesRes, optionsRes] = await Promise.all([
      apiFetch(`${API}/api/boe-entries/${row.uid}`),
      apiFetch(`${API}/api/shipping-options/${row.uid}`),
    ]);
    setEntries(entriesRes.ok ? await entriesRes.json() : []);
    if (optionsRes.ok) {
      const options: ShippingOptionRef[] = await optionsRes.json();
      setFreightRef(options.find((o) => o.is_selected) ?? null);
    }
  }

  async function handleAddEntry() {
    if (!editModal || !newEntry.amount) return;
    setSaving(true);
    const res = await apiFetch(`${API}/api/boe-entries/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: editModal.uid,
        amount: newEntry.amount,
        currency: newEntry.currency,
        rate: newEntry.currency === "INR" ? null : newEntry.rate,
        note: newEntry.note || null,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      const newEntries = [...entries, created];
      setEntries(newEntries);
      syncActualBoe(editModal.uid, newEntries);
      setNewEntry({ amount: "", currency: "INR", rate: "", note: "" });
    }
    setSaving(false);
  }

  async function handleDeleteEntry(entryId: number) {
    if (!editModal) return;
    await apiFetch(`${API}/api/boe-entries/${entryId}`, { method: "DELETE" });
    const remaining = entries.filter((e) => e.id !== entryId);
    setEntries(remaining);
    syncActualBoe(editModal.uid, remaining);
  }

  async function handleSaveEdit() {
    if (!editModal) return;
    setSaving(true);
    const requiredFields = ["boe_no", "customs_rate"];
    const allFilled = requiredFields.every((k) => (editForm[k] ?? "").trim() !== "");
    const res = await apiFetch(`${API}/api/rows/${editModal.uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, fields_entered: allFilled }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRows((r) => r.map((row) => row.uid === updated.uid ? updated : row));
      setEditModal(null);
    }
    setSaving(false);
  }

  async function handleAdvance(row: Row) {
    // Inbond rows go through the Bond tab (ex-bond splitting) before Transportation
    const nextStage = row.inbond === "Y" ? "bond" : "transportation";
    await apiFetch(`${API}/api/rows/${row.uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_status: nextStage }),
    });
    setRows((r) => r.filter((r2) => r2.uid !== row.uid));
  }

  async function handleBack(uid: string) {
    await apiFetch(`${API}/api/rows/${uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_status: "approved_import" }),
    });
    setRows((r) => r.filter((row) => row.uid !== uid));
  }

  const BOE_COLS = useMemo(() => applyColumnOrder(BOE_COLS_BASE, columnOrder), [columnOrder]);

  const entrySum = entries.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
  const entryInrSum = entries.reduce((acc, e) => acc + entryInrValue(e), 0);
  const provisionalBoePreview = editModal ? calcProvisional({ ...editModal, customs_rate: editForm.customs_rate ?? editModal.customs_rate }) : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b", margin: 0 }}>BOE</h1>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa", textTransform: "uppercase" }}>{rows.length} rows</span>
          <button style={btnStyle("ghost")} onClick={() => exportToExcel(filteredRows, "boe", Object.fromEntries(BOE_COLS.map(c => [c.key, c.label])))}>↓ Export</button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: compact ? undefined : "100%", minWidth: "max-content" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th style={TH}>#</th>
              {BOE_COLS.map((c) => {
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
            <InlineFilters colDefs={BOE_FILTER_DEFS} filters={filters} distinctValues={distinctValues} onFilter={setFilter} leadingCells={1} trailingCells={2} />
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={BOE_COLS.length + 2} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>{rows.length === 0 ? "No rows in BOE stage" : "No results match filters"}</td></tr>
            ) : (filteredRows as Row[]).map((row, i) => (
              <tr key={row.uid}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>{String(i + 1).padStart(3, "0")}</td>
                {BOE_COLS.map((col) => {
                  if (col.key === "provisional_boe_calc") return <td key="provisional_boe_calc" style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{calcProvisional(row)}</td>;
                  if (col.key === "actual_boe") return <td key="actual_boe" style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.actual_boe ?? "0"}</td>;
                  if (col.key === "actual_boe_inr") return <td key="actual_boe_inr" style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.actual_boe_inr ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>;
                  const v = String(row[col.key] ?? "");
                  const mono = col.key !== "supplier_name";
                  return <td key={col.key} style={{ ...TD, fontFamily: mono ? "var(--font-mono), monospace" : undefined }}>{v || <span style={{ color: "#d4d4d8" }}>—</span>}</td>;
                })}
                <td style={{ ...TD, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button style={btnStyle("ghost")} onClick={() => handleBack(row.uid as string)}>← Import</button>
                    <button style={btnStyle("action")} onClick={() => openEditModal(row)}>
                      {row.fields_entered ? "Edit Fields" : "Enter Fields"}
                    </button>
                    <button style={{ ...btnStyle("primary"), ...(!row.fields_entered ? { opacity: 0.4, cursor: "not-allowed" } : {}) }} onClick={() => { if (!row.fields_entered) return; handleAdvance(row); }}>
                      {row.inbond === "Y" ? "→ Bond" : "→ Transport"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "600px", maxHeight: "88vh", overflow: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400 }}>Edit BOE Fields</h2>

            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
              BOE No
              <input style={inputStyle} value={editForm.boe_no ?? ""} onChange={(e) => setEditForm({ ...editForm, boe_no: e.target.value })} />
            </label>

            {/* Reference values — read-only context for entering Actual BOE costs */}
            <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px", background: "#fafafa" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reference</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", display: "flex", flexDirection: "column", gap: "4px" }}>
                  PI Value ({editModal.currency ?? "—"})
                  <input style={readOnlyStyle} value={editModal.pi_total_value ?? "—"} readOnly />
                </label>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Currency
                  <input style={readOnlyStyle} value={editModal.currency ?? "—"} readOnly />
                </label>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Rate
                  <input style={readOnlyStyle} value={editModal.exchange_rate ?? "—"} readOnly />
                </label>
              </div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", display: "flex", flexDirection: "column", gap: "4px" }}>
                Insurance (INR)
                <input style={readOnlyStyle} value={editModal.insurance ?? "—"} readOnly />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Freight ({freightRef?.currency ?? "—"})
                  <input style={readOnlyStyle} value={freightRef?.freight ?? "—"} readOnly />
                </label>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Currency
                  <input style={readOnlyStyle} value={freightRef?.currency ?? "—"} readOnly />
                </label>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Rate
                  <input style={readOnlyStyle} value={freightRef?.exchange_rate ?? "—"} readOnly />
                </label>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e4e4e7", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#52525b" }}>Actual BOE Entries</span>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead><tr><th style={TH}>Amount</th><th style={TH}>Currency</th><th style={TH}>Rate</th><th style={TH}>Note</th><th style={TH}></th></tr></thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td style={TD}>{e.amount}</td>
                      <td style={TD}>{e.currency ?? "INR"}</td>
                      <td style={TD}>{e.currency && e.currency !== "INR" ? (e.rate ?? "—") : "—"}</td>
                      <td style={TD}>{e.note ?? "—"}</td>
                      <td style={TD}><button style={{ ...btnStyle("ghost"), padding: "2px 8px", fontSize: "11px", color: "#ef4444", borderColor: "#fecaca" }} onClick={() => handleDeleteEntry(e.id)}>✕</button></td>
                    </tr>
                  ))}
                  <tr style={{ background: "#fafafa" }}>
                    <td style={{ padding: "6px 8px" }}><input style={{ ...inputStyle, width: "90px" }} placeholder="Amount" value={newEntry.amount} onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })} /></td>
                    <td style={{ padding: "6px 8px" }}>
                      <select style={{ ...inputStyle, width: "80px" }} value={newEntry.currency} onChange={(e) => setNewEntry({ ...newEntry, currency: e.target.value, rate: e.target.value === "INR" ? "" : newEntry.rate })}>
                        {ENTRY_CCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <input style={{ ...inputStyle, width: "80px" }} placeholder="Rate" disabled={newEntry.currency === "INR"} value={newEntry.rate}
                        onChange={(e) => setNewEntry({ ...newEntry, rate: e.target.value })} />
                    </td>
                    <td style={{ padding: "6px 8px" }}><input style={{ ...inputStyle, width: "130px" }} placeholder="Note (optional)" value={newEntry.note} onChange={(e) => setNewEntry({ ...newEntry, note: e.target.value })} /></td>
                    <td style={{ padding: "6px 8px" }}><button style={btnStyle("primary")} onClick={handleAddEntry} disabled={saving}>{saving ? "…" : "Add"}</button></td>
                  </tr>
                </tbody>
              </table>

              <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px", width: "160px" }}>
                Customs Rate (%)
                <AmountInput style={inputStyle} value={editForm.customs_rate ?? ""} placeholder="e.g. 11"
                  onChange={(raw) => setEditForm({ ...editForm, customs_rate: raw })} />
              </label>

              <div style={{ display: "flex", gap: "16px", fontSize: "12px", fontFamily: "var(--font-mono), monospace", color: "#52525b", flexWrap: "wrap" }}>
                <span>Provisional BOE: {provisionalBoePreview}</span>
                <span>Sum: {entrySum > 0 ? entrySum.toFixed(2) : "0"}</span>
                <span style={{ fontWeight: 600, color: "#09090b" }}>Actual BOE: {entryInrSum > 0 ? entryInrSum.toFixed(2) : "0"}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => setEditModal(null)}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleSaveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
