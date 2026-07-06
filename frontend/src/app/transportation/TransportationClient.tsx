"use client";
import { API, apiFetch } from "@/lib/apiFetch";
import { useState, useEffect, useMemo } from "react";
import { usePolling } from "@/lib/usePolling";
import AmountInput from "@/components/AmountInput";
import InlineFilters from "@/components/InlineFilters";
import { useTableState, ColDef } from "@/components/useTableState";
import { exportToExcel } from "@/lib/exportExcel";
import { applyColumnOrder, useColumnOrder } from "@/lib/columnOrder";

export const TRANSPORT_COL_DEFS_BASE: ColDef[] = [
  { key: "supplier_name",              label: "Supplier",          type: "text"   },
  { key: "supplier_code",              label: "Supp. Code",        type: "text"   },
  { key: "pi_number",                  label: "PI Number",         type: "text"   },
  { key: "exbond_boe_no",              label: "Exbond BOE No",     type: "text"   },
  { key: "exbond_quantity",            label: "Exbond Qty",        type: "amount" },
  { key: "pi_quantity",                label: "PI Qty",            type: "amount" },
  { key: "actual_boe",                 label: "Actual BOE",        type: "amount" },
  { key: "eway_bill",                  label: "E-Way Bill",        type: "text"   },
  { key: "sap_inward_no",              label: "SAP Inward No",     type: "text"   },
  { key: "cha_name",                   label: "CHA Name",          type: "text"   },
  { key: "cha_charges",                label: "CHA Charges",       type: "amount" },
  { key: "other_charges",              label: "Other Charges",     type: "amount" },
  { key: "confirmed_destination_charges", label: "Conf. Dest. Charges", type: "amount" },
  { key: "transportation_inbound",     label: "Transport Inbound", type: "amount" },
  { key: "transportation_outbound_home", label: "Transport Outbound", type: "amount" },
  { key: "landing_cost",               label: "Landing Cost",      type: "amount" },
];

interface Row { id: number; uid: string; cha_name: string | null; cha_charges: string | null; transportation_inbound: string | null; transportation_outbound_home: string | null; eway_bill: string | null; sap_inward_no: string | null; other_charges: string | null; confirmed_destination_charges: string | null; landing_cost: string | null; total_transport: string | null; actual_boe: string | null; pi_quantity: string | null; po_quantity: string | null; inbond: string | null; home_consumption: string | null; fields_entered: boolean | null; [key: string]: string | null | number | boolean; }
interface ChaRecord { id: number; cha_name: string; agent_name: string | null; cha_charges: string | null; date: string | null; }


const TRANSPORT_FIELDS = [
  { key: "eway_bill",                     label: "E-Way Bill",               amount: false },
  { key: "sap_inward_no",                 label: "SAP Inward No",            amount: false },
  { key: "cha_name",                      label: "CHA Name",                 amount: false },
  { key: "cha_charges",                   label: "CHA Charges",              amount: true  },
  { key: "other_charges",                 label: "Other Charges",            amount: true  },
  { key: "confirmed_destination_charges", label: "Confirmed Dest. Charges",  amount: true  },
  { key: "transportation_inbound",        label: "Transport Inbound",        amount: true  },
  { key: "transportation_outbound_home",  label: "Transport Outbound/Home",  amount: true  },
];

// total_calc is a client-side computed preview (not a real row field), so it carries no
// filter and is kept as a trailing column to stay aligned with the filter row.
export const TRANSPORT_COLS_BASE = [
  { key: "supplier_name", label: "Supplier" },
  { key: "supplier_code", label: "Supp. Code" },
  { key: "pi_number", label: "PI Number" },
  { key: "exbond_boe_no", label: "Exbond BOE No" },
  { key: "exbond_quantity", label: "Exbond Qty" },
  { key: "pi_quantity", label: "PI Qty" },
  { key: "actual_boe", label: "Actual BOE" },
  ...TRANSPORT_FIELDS,
  { key: "landing_cost", label: "Landing Cost" },
  { key: "total_calc", label: "Total" },
];

const LANDING_COST_KEYS = new Set(["cha_charges", "other_charges", "confirmed_destination_charges", "transportation_inbound", "transportation_outbound_home"]);

function calcTotal(row: Row): string {
  const keys = ["transportation_inbound", "transportation_outbound_home", "eway_bill", "sap_inward_no", "cha_charges", "other_charges", "confirmed_destination_charges"];
  const sum = keys.reduce((acc, k) => acc + (parseFloat(String(row[k] ?? "0")) || 0), 0);
  return sum.toFixed(2);
}

function calcLandingCost(form: Record<string, string>, row: Row): string {
  const actualBoe = parseFloat(String(row.actual_boe ?? "0")) || 0;
  const cha   = parseFloat(form.cha_charges  || "0") || 0;
  const other = parseFloat(form.other_charges || "0") || 0;
  const dest  = parseFloat(form.confirmed_destination_charges || "0") || 0;
  const isInbond = row.inbond?.trim().toUpperCase() === "Y";
  const isHome   = row.home_consumption?.trim().toUpperCase() === "Y";
  const transport = isInbond ? (parseFloat(form.transportation_inbound || "0") || 0)
                  : isHome   ? (parseFloat(form.transportation_outbound_home || "0") || 0)
                  : 0;
  const qty = parseFloat(String(row.pi_quantity ?? row.po_quantity ?? "0")) || 0;
  const result = qty > 0 ? (actualBoe + cha + other + dest + transport) / qty : 0;
  return result > 0 ? result.toFixed(2) : "";
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

const TH: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b", background: "#fafafa", borderBottom: "1px solid #e4e4e7", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "9px 14px", fontSize: "13px", borderBottom: "1px solid #f4f4f5", color: "#09090b", whiteSpace: "nowrap" };

export default function TransportationClient({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const columnOrder = useColumnOrder("transportation");
  const TRANSPORT_COL_DEFS = useMemo(() => applyColumnOrder(TRANSPORT_COL_DEFS_BASE, columnOrder), [columnOrder]);
  const { filteredRows, filters, sort, distinctValues, setFilter, setSort } =
    useTableState(rows as unknown as Record<string, unknown>[], TRANSPORT_COL_DEFS, "transportation");
  const [editModal, setEditModal] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [chaRecords, setChaRecords] = useState<ChaRecord[]>([]);

  async function fetchRows() {
    const res = await apiFetch(`${API}/api/rows/stage/transportation`);
    if (res.ok) setRows(await res.json());
  }
  useEffect(() => { fetchRows(); }, []);
  usePolling(fetchRows, 10_000);

  async function openEdit(row: Row) {
    const form: Record<string, string> = {};
    TRANSPORT_FIELDS.forEach(({ key }) => { form[key] = String(row[key] ?? ""); });
    form.landing_cost = calcLandingCost(form, row);
    setEditForm(form);
    setEditModal(row);
    if (chaRecords.length === 0) {
      const res = await apiFetch(`${API}/api/cha/`);
      const data = res.ok ? await res.json() : [];
      setChaRecords(Array.isArray(data) ? data : []);
    }
  }

  function handleEditChange(key: string, value: string) {
    const next = { ...editForm, [key]: value };
    if (key === "cha_name") {
      const rec = chaRecords.find((c) => c.cha_name === value);
      if (rec?.cha_charges) next.cha_charges = rec.cha_charges;
    }
    if (LANDING_COST_KEYS.has(key) && editModal) {
      next.landing_cost = calcLandingCost(next, editModal);
    }
    // also recalc if cha_charges just got auto-filled
    if (key === "cha_name" && editModal) {
      next.landing_cost = calcLandingCost(next, editModal);
    }
    setEditForm(next);
  }

  async function handleSave() {
    if (!editModal) return;
    setSaving(true);
    const isInbond = editModal.inbond?.trim().toUpperCase() === "Y";
    const isHome = editModal.home_consumption?.trim().toUpperCase() === "Y";
    const requiredFields = ["eway_bill", "sap_inward_no", "cha_name", "cha_charges", "other_charges", "confirmed_destination_charges"];
    if (isInbond) requiredFields.push("transportation_inbound");
    else if (isHome) requiredFields.push("transportation_outbound_home");
    const allFilled = requiredFields.every((k) => (editForm[k] ?? "").trim() !== "");
    const res = await apiFetch(`${API}/api/rows/${editModal.uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, fields_entered: allFilled }),
    });
    if (res.ok) {
      const updated = await res.json();
      // auto-save new CHA to master if not already there
      if (editForm.cha_name && !chaRecords.find((c) => c.cha_name === editForm.cha_name)) {
        const today = new Date().toISOString().slice(0, 10);
        const r = await apiFetch(`${API}/api/cha/`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cha_name: editForm.cha_name, cha_charges: editForm.cha_charges || null, date: today }),
        });
        if (r.ok) { const created = await r.json(); setChaRecords((c) => [...c, created]); }
      }
      setRows((r) => r.map((row) => row.uid === updated.uid ? updated : row));
      setEditModal(null);
    }
    setSaving(false);
  }

  async function handleAdvance(uid: string) {
    await apiFetch(`${API}/api/rows/${uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_status: "due_date" }),
    });
    setRows((r) => r.filter((row) => row.uid !== uid));
  }

  async function handleBack(uid: string) {
    await apiFetch(`${API}/api/rows/${uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_status: "boe" }),
    });
    setRows((r) => r.filter((row) => row.uid !== uid));
  }

  const ALL_COLS = useMemo(() => applyColumnOrder(TRANSPORT_COLS_BASE, columnOrder), [columnOrder]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b", margin: 0 }}>Transportation</h1>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa", textTransform: "uppercase" }}>{rows.length} rows</span>
          <button style={btnStyle("ghost")} onClick={() => exportToExcel(filteredRows, "transportation", Object.fromEntries(TRANSPORT_COL_DEFS.map(c => [c.key, c.label])))}>↓ Export</button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th style={TH}>#</th>
              {ALL_COLS.map((c) => {
                const isSorted = sort?.key === c.key;
                return (
                  <th key={c.key} style={{ ...TH, background: c.key === "total_calc" ? "#f0f0f0" : "#fafafa", cursor: "pointer", userSelect: "none" }} onClick={() => setSort(c.key)}>
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
            <InlineFilters colDefs={TRANSPORT_COL_DEFS} filters={filters} distinctValues={distinctValues} onFilter={setFilter} leadingCells={1} trailingCells={2} />
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={ALL_COLS.length + 2} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>{rows.length === 0 ? "No rows in Transportation stage" : "No results match filters"}</td></tr>
            ) : (filteredRows as Row[]).map((row, i) => (
              <tr key={row.uid}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>{String(i + 1).padStart(3, "0")}</td>
                {ALL_COLS.map((col) => {
                  if (col.key === "total_calc") return <td key="total_calc" style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontWeight: 600, background: "#f9f9f9" }}>{calcTotal(row)}</td>;
                  const v = String(row[col.key] ?? "");
                  const isText = col.key === "cha_name" || col.key === "supplier_name";
                  return <td key={col.key} style={{ ...TD, fontFamily: isText ? undefined : "var(--font-mono), monospace" }}>{v || <span style={{ color: "#d4d4d8" }}>—</span>}</td>;
                })}
                <td style={{ ...TD, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button style={btnStyle("ghost")} onClick={() => handleBack(row.uid as string)}>← BOE</button>
                    <button style={btnStyle("action")} onClick={() => openEdit(row)}>
                      {row.fields_entered ? "Edit Fields" : "Enter Fields"}
                    </button>
                    <button style={{ ...btnStyle("primary"), ...(!row.fields_entered ? { opacity: 0.4, cursor: "not-allowed" } : {}) }} onClick={() => { if (!row.fields_entered) return; handleAdvance(row.uid as string); }}>→ Due Date</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "480px", maxHeight: "80vh", overflow: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400 }}>Edit Transportation</h2>
            {(() => {
              const isInbond = editModal?.inbond?.trim().toUpperCase() === "Y";
              const isHome   = editModal?.home_consumption?.trim().toUpperCase() === "Y";
              return TRANSPORT_FIELDS.map((f) => {
                const isTransportInbound  = f.key === "transportation_inbound";
                const isTransportOutbound = f.key === "transportation_outbound_home";
                const isTransportSection  = isTransportInbound || isTransportOutbound;

                // Determine if this transport field is disabled
                const disabled =
                  (isTransportInbound  && isHome  && !isInbond) ||
                  (isTransportOutbound && isInbond && !isHome);

                const labelExtra = isTransportSection
                  ? isInbond && isTransportInbound   ? <span style={{ fontWeight: 400, color: "#16a34a", fontSize: "11px" }}>● inbond</span>
                  : isHome  && isTransportOutbound   ? <span style={{ fontWeight: 400, color: "#16a34a", fontSize: "11px" }}>● home consumption</span>
                  : disabled                         ? <span style={{ fontWeight: 400, color: "#d4d4d8", fontSize: "11px" }}>not applicable</span>
                  : null
                  : f.key === "cha_charges"
                  ? <span style={{ fontWeight: 400, color: "#a1a1aa", fontSize: "11px" }}>auto-filled from CHA master</span>
                  : null;

                // Divider before transport section
                const divider = isTransportInbound ? (
                  <div key="transport-divider" style={{ borderTop: "1px solid #e4e4e7", marginTop: "4px", paddingTop: "4px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#a1a1aa", fontFamily: "var(--font-sans), sans-serif" }}>Transportation</span>
                  </div>
                ) : null;

                const fieldEl = f.key === "cha_name" ? (
                  <>
                    <input type="text" list="cha-list" style={inputStyle} placeholder="Select or type CHA name…"
                      value={editForm.cha_name ?? ""}
                      onChange={(e) => handleEditChange("cha_name", e.target.value)} />
                    <datalist id="cha-list">
                      {chaRecords.map((c) => <option key={c.id} value={c.cha_name}>{c.agent_name ? `${c.cha_name} — ${c.agent_name}` : c.cha_name}</option>)}
                    </datalist>
                  </>
                ) : f.amount ? (
                  <AmountInput
                    style={{ ...inputStyle, ...(disabled ? { background: "#f4f4f5", color: "#d4d4d8", cursor: "not-allowed" } : {}) }}
                    placeholder={disabled ? "N/A" : f.label}
                    value={disabled ? "" : (editForm[f.key] ?? "")}
                    disabled={disabled}
                    onChange={(raw) => !disabled && handleEditChange(f.key, raw)}
                  />
                ) : (
                  <input
                    style={{ ...inputStyle, ...(disabled ? { background: "#f4f4f5", color: "#d4d4d8", cursor: "not-allowed" } : {}) }}
                    placeholder={disabled ? "N/A" : f.label}
                    value={disabled ? "" : (editForm[f.key] ?? "")}
                    disabled={disabled}
                    onChange={(e) => !disabled && handleEditChange(f.key, e.target.value)}
                  />
                );

                return (
                  <div key={f.key}>
                    {divider}
                    <label style={{ fontSize: "12px", fontWeight: 600, color: disabled ? "#d4d4d8" : "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ display: "flex", gap: "6px", alignItems: "center" }}>{f.label}{labelExtra}</span>
                      {fieldEl}
                    </label>
                  </div>
                );
              });
            })()}
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
              Landing Cost <span style={{ fontWeight: 400, color: "#a1a1aa", fontSize: "11px" }}>
                {editModal?.inbond?.trim().toUpperCase() === "Y"
                  ? "(actual BOE + CHA + other + dest. + transport inbound) ÷ qty — auto"
                  : editModal?.home_consumption?.trim().toUpperCase() === "Y"
                  ? "(actual BOE + CHA + other + dest. + transport outbound) ÷ qty — auto"
                  : "(actual BOE + CHA + other + dest. charges) ÷ qty — auto"}
              </span>
              <input style={{ ...inputStyle, background: "#f0f0f0", color: "#52525b" }} value={editForm.landing_cost ?? ""} readOnly />
            </label>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => setEditModal(null)}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
