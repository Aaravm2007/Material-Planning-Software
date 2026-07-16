"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect } from "react";
import { usePolling } from "@/lib/usePolling";
import AmountInput from "@/components/AmountInput";
import { exportToExcel } from "@/lib/exportExcel";
import { useDensity } from "@/components/DensityContext";

interface CreditRecord { id: number; company: string; credit_amt: string; date: string | null; }


const btnStyle = (v: "primary" | "danger" | "ghost"): React.CSSProperties => ({
  padding: "5px 12px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
  fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid", whiteSpace: "nowrap",
  ...(v === "primary" ? { background: "#09090b", color: "#fff", borderColor: "#09090b" } :
     v === "danger"   ? { background: "transparent", color: "#ef4444", borderColor: "#fecaca" } :
                         { background: "transparent", color: "#71717a", borderColor: "#e4e4e7" }),
});

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: "7px", border: "1px solid #e4e4e7",
  fontSize: "13px", fontFamily: "var(--font-sans), sans-serif", outline: "none", background: "#fafafa", color: "#09090b",
};

function fmt(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export default function CreditClient({ initialRecords }: { initialRecords: CreditRecord[] }) {
  const { compact } = useDensity();
  const TH: React.CSSProperties = { padding: compact ? "4px 8px" : "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b", background: "#fafafa", borderBottom: "1px solid #b8b8bf", whiteSpace: "nowrap", fontFamily: "var(--font-sans), sans-serif" };
  const TD: React.CSSProperties = { padding: compact ? "4px 8px" : "10px 16px", fontSize: "13px", borderBottom: "1px solid #d4d4d8", color: "#09090b", whiteSpace: "nowrap", fontFamily: "var(--font-sans), sans-serif" };
  const [records, setRecords] = useState<CreditRecord[]>(initialRecords);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ company: "", credit_amt: "", date: "" });
  const [saving, setSaving] = useState(false);

  function fetchRecords() {
    apiFetch(`${API}/api/credit/`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setRecords(Array.isArray(data) ? data : []));
  }
  useEffect(() => { fetchRecords(); }, []);
  usePolling(fetchRecords, 10_000);

  const totalCredit = records.reduce((sum, r) => sum + (parseFloat(r.credit_amt) || 0), 0);
  const creditUsed = 0; // to be wired up later

  async function handleAdd() {
    if (!form.company.trim() || !form.credit_amt.trim()) return;
    setSaving(true);
    const body: Record<string, string> = { company: form.company.trim(), credit_amt: form.credit_amt.trim() };
    if (form.date) body.date = form.date;
    const res = await apiFetch(`${API}/api/credit/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) {
      const created = await res.json();
      setRecords((r) => [created, ...r]);
      setForm({ company: "", credit_amt: "", date: "" });
      setShowModal(false);
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    await apiFetch(`${API}/api/credit/${id}`, { method: "DELETE" });
    setRecords((r) => r.filter((x) => x.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      {/* Banner */}
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "20px 24px", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: "11px", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.08em", textTransform: "uppercase", color: "#a1a1aa" }}>Credit Used / Total Credit</p>
          <p style={{ margin: 0, fontSize: "28px", fontFamily: "var(--font-mono), monospace", fontWeight: 700, color: "#09090b", letterSpacing: "-0.02em" }}>
            <span style={{ color: "#71717a" }}>₹ {fmt(creditUsed)}</span>
            <span style={{ color: "#d4d4d8", fontWeight: 300, margin: "0 10px" }}>/</span>
            <span>₹ {fmt(totalCredit)}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button style={btnStyle("ghost")} onClick={() => exportToExcel(records, "credit", { company: "Company", credit_amt: "Credit Amount", date: "Date" })}>↓ Export</button>
          <button style={btnStyle("primary")} onClick={() => setShowModal(true)}>+ Add Entry</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: compact ? undefined : "100%", minWidth: "max-content" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th style={TH}>#</th>
              <th style={TH}>Company</th>
              <th style={TH}>Credit Amount</th>
              <th style={TH}>Date</th>
              <th style={{ ...TH, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={5} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>No credit entries yet</td></tr>
            ) : records.map((r, i) => (
              <tr key={r.id}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                <td style={{ ...TD, color: "#a1a1aa", fontFamily: "var(--font-mono), monospace", fontSize: "11px" }}>{String(i + 1).padStart(3, "0")}</td>
                <td style={{ ...TD, fontWeight: 500 }}>{r.company}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontWeight: 600 }}>₹ {fmt(parseFloat(r.credit_amt) || 0)}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", color: "#71717a" }}>{r.date ?? "—"}</td>
                <td style={{ ...TD, textAlign: "right" }}>
                  <button style={btnStyle("danger")} onClick={() => handleDelete(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "400px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>Add Credit Entry</h2>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Company *
              <input type="text" style={inputStyle} placeholder="Company name" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
            </label>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Credit Amount (₹) *
              <AmountInput style={inputStyle} placeholder="e.g. 50,00,000" value={form.credit_amt} onChange={(raw) => setForm((f) => ({ ...f, credit_amt: raw }))} />
            </label>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Date
              <input type="date" style={inputStyle} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </label>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => { setShowModal(false); setForm({ company: "", credit_amt: "", date: "" }); }}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleAdd} disabled={saving || !form.company.trim() || !form.credit_amt.trim()}>{saving ? "Saving…" : "Add"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
