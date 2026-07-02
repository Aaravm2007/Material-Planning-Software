"use client";
import { API, apiFetch } from "@/lib/apiFetch";
import { useState, useEffect } from "react";
import { usePolling } from "@/lib/usePolling";
import AmountInput from "@/components/AmountInput";
import InlineFilters from "@/components/InlineFilters";
import { useTableState, ColDef } from "@/components/useTableState";

const DUEDATE_COL_DEFS: ColDef[] = [
  { key: "supplier_name",             label: "Supplier",            type: "text"   },
  { key: "supplier_code",             label: "Supp. Code",          type: "text"   },
  { key: "pi_number",                 label: "PI Number",           type: "text"   },
  { key: "po_total_value",            label: "PO Total Value",      type: "amount" },
  { key: "bl_date",                   label: "BL Date",             type: "date"   },
  { key: "credit_time",               label: "Credit Time",         type: "amount" },
  { key: "confirmed_due_date",        label: "Confirmed Due Date",  type: "date"   },
  { key: "advance_given",             label: "Advance Given",       type: "amount" },
  { key: "hedged",                    label: "Hedged",              type: "select", options: ["Y","N"] },
  { key: "confirmed_payment_amt",     label: "Payment Amt",         type: "amount" },
  { key: "confirmed_payment_exchange",label: "Payment Exchange",    type: "amount" },
];

interface Row { id: number; uid: string; bl_date: string | null; credit_time: string | null; estimated_due_date: string | null; confirmed_due_date: string | null; hedged: string | null; confirmed_payment_amt: string | null; confirmed_payment_exchange: string | null; [key: string]: string | null | number; }
interface HedgingRecord { id: number; contract_number: string | null; hedge_rate: string | null; hedged_currency_amount: string | null; currency: string | null; hedged_date: string | null; }
interface ContractSelection { record: HedgingRecord; amount: string; }


const DUE_FIELDS = [
  { key: "confirmed_due_date",         label: "Confirmed Due Date"    },
  { key: "advance_given",              label: "Advance Given"         },
  { key: "hedged",                     label: "Hedged"                },
  { key: "confirmed_payment_amt",      label: "Confirmed Payment Amt" },
  { key: "confirmed_payment_exchange", label: "Payment Exchange Rate" },
];

function calcPaymentAmt(form: Record<string, string>, row: Row): string {
  const total = parseFloat(String(row.po_total_value ?? "0")) || 0;
  const advance = parseFloat(form.advance_given || "0") || 0;
  const result = total - advance;
  return result > 0 ? String(result) : total > 0 ? String(total) : "";
}

function calcWeightedRate(selections: ContractSelection[]): string {
  const valid = selections.filter((s) => parseFloat(s.amount) > 0);
  if (valid.length === 0) return "";
  const totalAmt = valid.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const weighted = valid.reduce((sum, s) => sum + (parseFloat(s.amount) || 0) * (parseFloat(s.record.hedge_rate || "0") || 0), 0);
  return totalAmt > 0 ? (weighted / totalAmt).toFixed(4) : "";
}

function calcEstimatedDueDate(row: Row): string {
  const blDate = row.bl_date;
  const creditTime = row.credit_time;
  if (!blDate || !creditTime) return "—";
  const days = parseInt(creditTime as string, 10);
  if (isNaN(days)) return "—";
  const d = new Date(blDate as string);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const btnStyle = (v: "primary" | "ghost" | "action" | "complete" | "danger"): React.CSSProperties => ({
  padding: "5px 12px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
  fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid", whiteSpace: "nowrap",
  ...(v === "primary"  ? { background: "#09090b", color: "#fff", borderColor: "#09090b" } :
     v === "complete"  ? { background: "#16a34a", color: "#fff", borderColor: "#16a34a" } :
     v === "action"    ? { background: "#f4f4f5", color: "#09090b", borderColor: "#e4e4e7" } :
     v === "danger"    ? { background: "transparent", color: "#ef4444", borderColor: "#fecaca" } :
                          { background: "transparent", color: "#71717a", borderColor: "#e4e4e7" }),
});

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: "7px", border: "1px solid #e4e4e7",
  fontSize: "13px", fontFamily: "var(--font-sans), sans-serif", outline: "none", background: "#fafafa",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: "pointer",
};

const TH: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b", background: "#fafafa", borderBottom: "1px solid #e4e4e7", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "9px 14px", fontSize: "13px", borderBottom: "1px solid #f4f4f5", color: "#09090b", whiteSpace: "nowrap" };

export default function DueDateClient({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const { filteredRows, filters, sort, distinctValues, setFilter, setSort } =
    useTableState(rows as unknown as Record<string, unknown>[], DUEDATE_COL_DEFS, "due_date");
  const [editModal, setEditModal] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Hedging contract selection state
  const [hedgingRecords, setHedgingRecords] = useState<HedgingRecord[]>([]);
  const [contractSelections, setContractSelections] = useState<ContractSelection[]>([]);
  const [addContractId, setAddContractId] = useState<string>("");

  async function fetchRows() {
    const res = await apiFetch(`${API}/api/rows/`);
    if (res.ok) setRows(await res.json());
  }
  useEffect(() => { fetchRows(); }, []);
  usePolling(fetchRows, 10_000);

  async function fetchHedgingRecords() {
    const res = await apiFetch(`${API}/api/hedging/`);
    const data = res.ok ? await res.json() : [];
    setHedgingRecords(Array.isArray(data) ? data : []);
  }

  function openEdit(row: Row) {
    const form: Record<string, string> = {};
    DUE_FIELDS.forEach(({ key }) => { form[key] = String(row[key] ?? ""); });
    form.confirmed_payment_amt = calcPaymentAmt(form, row);
    setEditForm(form);
    setEditModal(row);
    setContractSelections([]);
    setAddContractId("");
    if (String(row.hedged ?? "").toUpperCase() === "Y") fetchHedgingRecords();
  }

  function handleEditChange(key: string, value: string) {
    const next = { ...editForm, [key]: value };
    if (key === "advance_given" && editModal) {
      next.confirmed_payment_amt = calcPaymentAmt(next, editModal);
    }
    if (key === "hedged") {
      if (value === "Y") {
        setContractSelections([]);
        next.confirmed_payment_exchange = "";
        fetchHedgingRecords();
      } else {
        setContractSelections([]);
      }
    }
    setEditForm(next);
  }

  function addContract() {
    if (!addContractId) return;
    const record = hedgingRecords.find((r) => String(r.id) === addContractId);
    if (!record || contractSelections.some((s) => s.record.id === record.id)) return;
    const next = [...contractSelections, { record, amount: "" }];
    setContractSelections(next);
    setAddContractId("");
    const rate = calcWeightedRate(next);
    setEditForm((f) => ({ ...f, confirmed_payment_exchange: rate }));
  }

  function updateContractAmount(idx: number, amount: string) {
    const next = contractSelections.map((s, i) => i === idx ? { ...s, amount } : s);
    setContractSelections(next);
    const rate = calcWeightedRate(next);
    setEditForm((f) => ({ ...f, confirmed_payment_exchange: rate }));
  }

  function removeContract(idx: number) {
    const next = contractSelections.filter((_, i) => i !== idx);
    setContractSelections(next);
    const rate = calcWeightedRate(next);
    setEditForm((f) => ({ ...f, confirmed_payment_exchange: rate }));
  }

  async function handleSave() {
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

  async function handleComplete(row: Row) {
    await apiFetch(`${API}/api/rows/${row.uid as string}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_status: "complete" }),
    });
    setRows((r) => r.filter((r2) => r2.uid !== row.uid));
  }

  async function handleBack(uid: string) {
    await apiFetch(`${API}/api/rows/${uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_status: "transportation" }),
    });
    setRows((r) => r.filter((row) => row.uid !== uid));
  }

  const isHedgedYes = editForm.hedged === "Y";

  const ALL_COLS = [
    { key: "uid", label: "UID" },
    { key: "supplier_name", label: "Supplier" },
    { key: "supplier_code", label: "Supp. Code" },
    { key: "pi_number", label: "PI Number" },
    { key: "po_total_value", label: "PO Total Value" },
    { key: "bl_date", label: "BL Date" },
    { key: "credit_time", label: "Credit Time (days)" },
    { key: "_est_due_calc", label: "Estimated Due Date" },
    ...DUE_FIELDS,
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b", margin: 0 }}>Due Date</h1>
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa", textTransform: "uppercase" }}>{rows.length} rows</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th style={TH}>#</th>
              {ALL_COLS.map((c) => {
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
            <InlineFilters colDefs={DUEDATE_COL_DEFS} filters={filters} distinctValues={distinctValues} onFilter={setFilter} leadingCells={1} trailingCells={1} />
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={ALL_COLS.length + 2} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>{rows.length === 0 ? "No rows in Due Date stage" : "No results match filters"}</td></tr>
            ) : (filteredRows as Row[]).map((row, i) => (
              <tr key={row.uid}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>{String(i + 1).padStart(3, "0")}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>{String(row.uid).slice(0, 8)}…</td>
                {ALL_COLS.slice(1).map((col) => {
                  if (col.key === "_est_due_calc") {
                    const val = calcEstimatedDueDate(row);
                    return <td key={col.key} style={{ ...TD, fontFamily: "var(--font-mono), monospace", color: val === "—" ? "#d4d4d8" : "#09090b" }}>{val}</td>;
                  }
                  if (col.key === "hedged") {
                    const yes = String(row.hedged ?? "").toUpperCase() === "Y";
                    return (
                      <td key={col.key} style={TD}>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "28px", height: "18px", border: `1px solid ${yes ? "#09090b" : "#d4d4d8"}`, borderRadius: "6px", fontSize: "10px", fontWeight: 600, color: yes ? "#fff" : "#a1a1aa", background: yes ? "#09090b" : "transparent" }}>
                          {yes ? "Y" : "N"}
                        </span>
                      </td>
                    );
                  }
                  const v = String(row[col.key] ?? "");
                  const mono = col.key.includes("amt") || col.key.includes("exchange") || col.key === "credit_time" || col.key === "bl_date" || col.key === "po_total_value";
                  return <td key={col.key} style={{ ...TD, fontFamily: mono ? "var(--font-mono), monospace" : undefined }}>{v || <span style={{ color: "#d4d4d8" }}>—</span>}</td>;
                })}
                <td style={{ ...TD, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button style={btnStyle("ghost")} onClick={() => handleBack(row.uid as string)}>← Transport</button>
                    <button style={btnStyle("action")} onClick={() => openEdit(row)}>Edit</button>
                    <button style={btnStyle("complete")} onClick={() => handleComplete(row)}>✓ Complete</button>
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
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "520px", maxHeight: "85vh", overflow: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400 }}>Edit Due Date Fields</h2>

            {/* Confirmed Due Date */}
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
              Confirmed Due Date
              <input type="date" style={inputStyle} value={editForm.confirmed_due_date ?? ""} onChange={(e) => handleEditChange("confirmed_due_date", e.target.value)} />
            </label>

            {/* Advance Given */}
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
              Advance Given
              <AmountInput style={inputStyle} placeholder="Advance Given" value={editForm.advance_given ?? ""} onChange={(raw) => handleEditChange("advance_given", raw)} />
            </label>

            {/* Confirmed Payment Amt — auto */}
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
              Confirmed Payment Amt <span style={{ fontWeight: 400, color: "#a1a1aa", fontSize: "11px" }}>(PO total − advance) — auto</span>
              <input type="text" style={{ ...inputStyle, background: "#f0f0f0", color: "#52525b" }} value={editForm.confirmed_payment_amt ?? ""} readOnly />
            </label>

            {/* Hedged — Y/N select */}
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
              Hedged
              <select style={selectStyle} value={editForm.hedged ?? ""} onChange={(e) => handleEditChange("hedged", e.target.value)}>
                <option value="">— select —</option>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </select>
            </label>

            {/* If YES — contract picker */}
            {isHedgedYes && (
              <div style={{ border: "1px solid #e4e4e7", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px", background: "#fafafa" }}>
                <p style={{ margin: 0, fontSize: "11px", fontWeight: 600, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono), monospace" }}>Select Hedging Contracts</p>

                {/* Selected contracts */}
                {contractSelections.length > 0 && (
                  <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px" }}>
                    <thead>
                      <tr>
                        {["Contract No", "Date", "Rate", "Available", "Amount to Use", ""].map((h) => (
                          <th key={h} style={{ padding: "5px 8px", textAlign: "left", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#a1a1aa", borderBottom: "1px solid #e4e4e7" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {contractSelections.map((sel, idx) => (
                        <tr key={sel.record.id}>
                          <td style={{ padding: "5px 8px", fontFamily: "var(--font-mono), monospace", fontSize: "12px" }}>{sel.record.contract_number ?? "—"}</td>
                          <td style={{ padding: "5px 8px", fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#71717a" }}>{sel.record.hedged_date ?? "—"}</td>
                          <td style={{ padding: "5px 8px", fontFamily: "var(--font-mono), monospace", fontSize: "12px" }}>{sel.record.hedge_rate ?? "—"}</td>
                          <td style={{ padding: "5px 8px", fontFamily: "var(--font-mono), monospace", fontSize: "12px", color: "#71717a" }}>{sel.record.hedged_currency_amount ?? "—"} {sel.record.currency ?? ""}</td>
                          <td style={{ padding: "5px 8px" }}>
                            <input type="text" placeholder="Amount" value={sel.amount}
                              onChange={(e) => updateContractAmount(idx, e.target.value)}
                              style={{ width: "90px", padding: "4px 7px", borderRadius: "5px", border: "1px solid #e4e4e7", fontSize: "12px", fontFamily: "var(--font-mono), monospace", outline: "none", background: "#fff" }} />
                          </td>
                          <td style={{ padding: "5px 8px" }}>
                            <button style={{ ...btnStyle("danger"), padding: "2px 7px", fontSize: "11px" }} onClick={() => removeContract(idx)}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Add contract row */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select style={{ ...selectStyle, flex: 1, fontSize: "12px", padding: "5px 8px" }} value={addContractId} onChange={(e) => setAddContractId(e.target.value)}>
                    <option value="">— add contract —</option>
                    {hedgingRecords
                      .filter((r) => !contractSelections.some((s) => s.record.id === r.id))
                      .map((r) => (
                        <option key={r.id} value={String(r.id)}>
                          {r.contract_number ?? `#${r.id}`} — rate {r.hedge_rate} ({r.currency}) {r.hedged_date ? `· ${r.hedged_date}` : ""}
                        </option>
                      ))}
                  </select>
                  <button style={{ ...btnStyle("action"), whiteSpace: "nowrap" }} onClick={addContract}>+ Add</button>
                </div>

                {/* Weighted rate display */}
                {contractSelections.some((s) => parseFloat(s.amount) > 0) && (
                  <div style={{ padding: "8px 10px", borderRadius: "7px", background: "#f0f0f0", fontSize: "12px", fontFamily: "var(--font-mono), monospace", color: "#09090b" }}>
                    Weighted Rate: <strong>{calcWeightedRate(contractSelections)}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Payment Exchange Rate */}
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
              Payment Exchange Rate
              {isHedgedYes
                ? <input type="text" style={{ ...inputStyle, background: "#f0f0f0", color: "#52525b" }} value={editForm.confirmed_payment_exchange ?? ""} readOnly placeholder="Auto from contracts" />
                : <input type="text" style={inputStyle} placeholder="Enter exchange rate" value={editForm.confirmed_payment_exchange ?? ""} onChange={(e) => handleEditChange("confirmed_payment_exchange", e.target.value)} />
              }
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
