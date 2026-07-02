"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect } from "react";
import { usePolling } from "@/lib/usePolling";

interface HedgingRecord {
  id: number;
  hedged_date: string | null;
  contract_number: string | null;
  hedge_rate: string | null;
  hedged_currency_amount: string | null;
  currency: string | null;
  amount_in_inr: string | null;
  created_at: string | null;
}


const btnStyle = (v: "primary" | "ghost" | "danger"): React.CSSProperties => ({
  padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
  fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid", whiteSpace: "nowrap",
  ...(v === "primary" ? { background: "#09090b", color: "#fff", borderColor: "#09090b" } :
     v === "danger"   ? { background: "transparent", color: "#ef4444", borderColor: "#fecaca" } :
                         { background: "transparent", color: "#71717a", borderColor: "#e4e4e7" }),
});

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #e4e4e7",
  fontSize: "13px", fontFamily: "var(--font-sans), sans-serif", outline: "none",
  background: "#fafafa", color: "#09090b",
};

const TH: React.CSSProperties = {
  padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600,
  letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b",
  background: "#fafafa", borderBottom: "1px solid #e4e4e7", whiteSpace: "nowrap",
};
const TD: React.CSSProperties = {
  padding: "10px 16px", fontSize: "13px", borderBottom: "1px solid #f4f4f5",
  color: "#09090b", whiteSpace: "nowrap",
};

const FIELDS = [
  { key: "hedged_date",            label: "Hedged Date",              type: "date"   },
  { key: "contract_number",        label: "Hedging Contract No",      type: "text"   },
  { key: "hedge_rate",             label: "Hedge Rate",               type: "text"   },
  { key: "hedged_currency_amount", label: "Amount of Hedged Currency",type: "text"   },
  { key: "currency",               label: "Currency",                 type: "select" },
  { key: "amount_in_inr",          label: "Amount in INR (auto)",     type: "auto"   },
];

const emptyForm = () => Object.fromEntries(FIELDS.map((f) => [f.key, ""]));

export default function HedgingClient({ initialRecords }: { initialRecords: HedgingRecord[] }) {
  const [records, setRecords] = useState<HedgingRecord[]>(initialRecords);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(emptyForm());
  const [saving, setSaving] = useState(false);

  function fetchRecords() {
    apiFetch(`${API}/api/hedging/`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setRecords(Array.isArray(data) ? data : []));
  }
  useEffect(() => { fetchRecords(); }, []);
  usePolling(fetchRecords, 10_000);

  function handleFormChange(key: string, value: string) {
    const next = { ...form, [key]: value };
    if (key === "hedged_currency_amount" || key === "hedge_rate") {
      const amt = parseFloat(key === "hedged_currency_amount" ? value : next.hedged_currency_amount) || 0;
      const rate = parseFloat(key === "hedge_rate" ? value : next.hedge_rate) || 0;
      next.amount_in_inr = amt && rate ? String(parseFloat((amt * rate).toFixed(4))) : "";
    }
    setForm(next);
  }

  async function handleCreate() {
    setSaving(true);
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
    const res = await apiFetch(`${API}/api/hedging/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const created = await res.json();
      setRecords((r) => [created, ...r]);
      setShowModal(false);
      setForm(emptyForm());
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    await apiFetch(`${API}/api/hedging/${id}`, { method: "DELETE" });
    setRecords((r) => r.filter((x) => x.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <div>
          <p style={{ margin: "0 0 2px", fontSize: "11px", fontFamily: "var(--font-mono), monospace", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.06em" }}>Masters</p>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b" }}>Hedging</h1>
        </div>
        <button style={btnStyle("primary")} onClick={() => setShowModal(true)}>+ Add Record</button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th style={TH}>#</th>
              {FIELDS.map((f) => <th key={f.key} style={TH}>{f.label}</th>)}
              <th style={{ ...TH, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={FIELDS.length + 2} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>No hedging records yet</td></tr>
            ) : records.map((rec, i) => (
              <tr key={rec.id}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>{String(i + 1).padStart(3, "0")}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{rec.hedged_date ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{rec.contract_number ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{rec.hedge_rate ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{rec.hedged_currency_amount ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={TD}>{rec.currency ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{rec.amount_in_inr ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={{ ...TD, textAlign: "right" }}>
                  <button style={btnStyle("danger")} onClick={() => handleDelete(rec.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "440px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>Add Hedging Record</h2>
            {FIELDS.map((f) => (
              <label key={f.key} style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                {f.label}
                {f.type === "select" ? (
                  <select style={inputStyle} value={form[f.key]} onChange={(e) => handleFormChange(f.key, e.target.value)}>
                    <option value="">— select —</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="CNY">CNY (Chinese Yuan)</option>
                  </select>
                ) : f.type === "auto" ? (
                  <input type="text" style={{ ...inputStyle, background: "#f0f0f0", color: "#52525b" }}
                    value={form[f.key]} readOnly placeholder="Auto-calculated" />
                ) : (
                  <input type={f.type} style={inputStyle} placeholder={f.label}
                    value={form[f.key]} onChange={(e) => handleFormChange(f.key, e.target.value)} />
                )}
              </label>
            ))}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => { setShowModal(false); setForm(emptyForm()); }}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Add"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
