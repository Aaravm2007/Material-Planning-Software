"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState } from "react";
import InlineFilters from "@/components/InlineFilters";
import { useTableState, ColDef } from "@/components/useTableState";

const BOE_FILTER_DEFS: ColDef[] = [
  { key: "supplier_name",        label: "Supplier",        type: "text"   },
  { key: "supplier_code",        label: "Supp. Code",      type: "text"   },
  { key: "pi_number",            label: "PI Number",       type: "text"   },
  { key: "boe_no",               label: "BOE No",          type: "text"   },
  { key: "dollar_rate",          label: "Dollar Rate",     type: "amount" },
  { key: "custom_exchange_rate", label: "Custom Exch. Rate", type: "amount" },
  { key: "actual_boe",           label: "Actual BOE",      type: "amount" },
];

interface Row { id: number; uid: string; po_total_value: string | null; freight_charges: string | null; boe_no: string | null; dollar_rate: string | null; custom_exchange_rate: string | null; provisional_boe: string | null; actual_boe: string | null; [key: string]: string | null | number; }
interface BoeEntry { id: number; uid: string; amount: string; note: string | null; }


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

const TH: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b", background: "#fafafa", borderBottom: "1px solid #e4e4e7", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "9px 14px", fontSize: "13px", borderBottom: "1px solid #f4f4f5", color: "#09090b", whiteSpace: "nowrap" };

function calcProvisional(row: Row): string {
  const po  = parseFloat(row.po_total_value  ?? "0") || 0;
  const fr  = parseFloat(row.freight_charges ?? "0") || 0;
  const ins = parseFloat((row.insurance as string | null) ?? "0") || 0;
  const val = (po + fr + ins) * 0.11;
  return val > 0 ? val.toFixed(2) : "—";
}

export default function BoeClient({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const { filteredRows, filters, sort, distinctValues, setFilter, setSort } =
    useTableState(rows as unknown as Record<string, unknown>[], BOE_FILTER_DEFS, "boe");
  const [boeModal, setBoeModal] = useState<{ uid: string; entries: BoeEntry[] } | null>(null);
  const [newEntry, setNewEntry] = useState({ amount: "", note: "" });
  const [editModal, setEditModal] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function openBoeModal(uid: string) {
    const res = await apiFetch(`${API}/api/boe-entries/${uid}`);
    const entries = res.ok ? await res.json() : [];
    setBoeModal({ uid, entries });
  }

  function syncActualBoe(uid: string, entries: BoeEntry[]) {
    const sum = entries.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
    setRows((r) => r.map((row) => row.uid === uid ? { ...row, actual_boe: sum > 0 ? String(sum.toFixed(2)) : "0" } : row));
  }

  async function handleAddEntry() {
    if (!boeModal || !newEntry.amount) return;
    setSaving(true);
    const res = await apiFetch(`${API}/api/boe-entries/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: boeModal.uid, ...newEntry }),
    });
    if (res.ok) {
      const created = await res.json();
      const newEntries = [...boeModal.entries, created];
      setBoeModal((m) => m ? { ...m, entries: newEntries } : m);
      syncActualBoe(boeModal.uid, newEntries);
      setNewEntry({ amount: "", note: "" });
    }
    setSaving(false);
  }

  async function handleDeleteEntry(entryId: number) {
    if (!boeModal) return;
    await apiFetch(`${API}/api/boe-entries/${entryId}`, { method: "DELETE" });
    const remaining = boeModal.entries.filter((e) => e.id !== entryId);
    setBoeModal((m) => m ? { ...m, entries: remaining } : m);
    syncActualBoe(boeModal.uid, remaining);
  }

  async function handleSaveEdit() {
    if (!editModal) return;
    setSaving(true);
    const res = await apiFetch(`${API}/api/rows/${editModal.uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      const updated = await res.json();
      setRows((r) => r.map((row) => row.uid === updated.uid ? updated : row));
      setEditModal(null);
    }
    setSaving(false);
  }

  async function handleAdvance(uid: string) {
    await apiFetch(`${API}/api/rows/${uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_status: "transportation" }),
    });
    setRows((r) => r.filter((row) => row.uid !== uid));
  }

  async function handleBack(uid: string) {
    await apiFetch(`${API}/api/rows/${uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_status: "approved_import" }),
    });
    setRows((r) => r.filter((row) => row.uid !== uid));
  }

  const BOE_COLS = [
    { key: "uid", label: "UID" },
    { key: "supplier_name", label: "Supplier" },
    { key: "supplier_code", label: "Supp. Code" },
    { key: "pi_number", label: "PI Number" },
    { key: "boe_no", label: "BOE No" },
    { key: "dollar_rate", label: "Dollar Rate" },
    { key: "custom_exchange_rate", label: "Custom Exchange Rate" },
    { key: "provisional_boe_calc", label: "Provisional BOE (auto)" },
    { key: "actual_boe", label: "Actual BOE (sum)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b", margin: 0 }}>BOE</h1>
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa", textTransform: "uppercase" }}>{rows.length} rows</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
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
            <InlineFilters colDefs={BOE_FILTER_DEFS} filters={filters} distinctValues={distinctValues} onFilter={setFilter} leadingCells={1} trailingCells={1} />
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
                  if (col.key === "uid") return <td key="uid" style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>{String(row.uid).slice(0, 8)}…</td>;
                  if (col.key === "provisional_boe_calc") return <td key="provisional_boe_calc" style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{calcProvisional(row)}</td>;
                  if (col.key === "actual_boe") return (
                    <td key="actual_boe" style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {row.actual_boe ?? "0"}
                        <button style={{ ...btnStyle("action"), padding: "2px 8px", fontSize: "11px" }} onClick={() => openBoeModal(row.uid as string)}>+ Add</button>
                      </div>
                    </td>
                  );
                  const v = String(row[col.key] ?? "");
                  const mono = col.key !== "supplier_name";
                  return <td key={col.key} style={{ ...TD, fontFamily: mono ? "var(--font-mono), monospace" : undefined }}>{v || <span style={{ color: "#d4d4d8" }}>—</span>}</td>;
                })}
                <td style={{ ...TD, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button style={btnStyle("ghost")} onClick={() => handleBack(row.uid as string)}>← Import</button>
                    <button style={btnStyle("action")} onClick={() => { setEditModal(row); setEditForm({ boe_no: String(row.boe_no ?? ""), dollar_rate: String(row.dollar_rate ?? ""), custom_exchange_rate: String(row.custom_exchange_rate ?? "") }); }}>Edit</button>
                    <button style={btnStyle("primary")} onClick={() => handleAdvance(row.uid as string)}>→ Transport</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actual BOE entries modal */}
      {boeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleAddEntry(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "500px", maxHeight: "80vh", overflow: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400 }}>Actual BOE Entries</h2>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr><th style={TH}>Amount</th><th style={TH}>Note</th><th style={TH}></th></tr></thead>
              <tbody>
                {boeModal.entries.map((e) => (
                  <tr key={e.id}><td style={TD}>{e.amount}</td><td style={TD}>{e.note ?? "—"}</td>
                    <td style={TD}><button style={{ ...btnStyle("ghost"), padding: "2px 8px", fontSize: "11px", color: "#ef4444", borderColor: "#fecaca" }} onClick={() => handleDeleteEntry(e.id)}>✕</button></td>
                  </tr>
                ))}
                <tr style={{ background: "#fafafa" }}>
                  <td style={{ padding: "6px 8px" }}><input style={{ ...inputStyle, width: "120px" }} placeholder="Amount" value={newEntry.amount} onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })} /></td>
                  <td style={{ padding: "6px 8px" }}><input style={{ ...inputStyle, width: "160px" }} placeholder="Note (optional)" value={newEntry.note} onChange={(e) => setNewEntry({ ...newEntry, note: e.target.value })} /></td>
                  <td style={{ padding: "6px 8px" }}><button style={btnStyle("primary")} onClick={handleAddEntry} disabled={saving}>{saving ? "…" : "Add"}</button></td>
                </tr>
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => setBoeModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "420px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400 }}>Edit BOE Fields</h2>
            {[{ key: "boe_no", label: "BOE No" }, { key: "dollar_rate", label: "Dollar Rate" }, { key: "custom_exchange_rate", label: "Custom Exchange Rate" }].map((f) => (
              <label key={f.key} style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                {f.label}
                <input style={inputStyle} value={editForm[f.key] ?? ""} onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })} />
              </label>
            ))}
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
