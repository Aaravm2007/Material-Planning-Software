"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect } from "react";
import { usePolling } from "@/lib/usePolling";

interface ChaRecord {
  id: number;
  cha_name: string;
  agent_name: string | null;
  cha_charges: string | null;
  date: string | null;
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
  fontSize: "13px", fontFamily: "var(--font-sans), sans-serif", outline: "none", background: "#fafafa", color: "#09090b",
};

const TH: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b", background: "#fafafa", borderBottom: "1px solid #e4e4e7", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "10px 16px", fontSize: "13px", borderBottom: "1px solid #f4f4f5", color: "#09090b", whiteSpace: "nowrap" };

const COLS = [
  { key: "cha_name",    label: "CHA Name"    },
  { key: "agent_name",  label: "Agent Name"  },
  { key: "cha_charges", label: "CHA Charges" },
  { key: "date",        label: "Date"        },
];

const emptyForm = () => ({ cha_name: "", agent_name: "", cha_charges: "", date: "" });

export default function ChaClient({ initialRecords }: { initialRecords: ChaRecord[] }) {
  const [records, setRecords] = useState<ChaRecord[]>(initialRecords);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  function fetchRecords() {
    apiFetch(`${API}/api/cha/`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setRecords(Array.isArray(data) ? data : []));
  }
  useEffect(() => { fetchRecords(); }, []);
  usePolling(fetchRecords, 10_000);

  async function handleCreate() {
    if (!form.cha_name.trim()) return;
    setSaving(true);
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
    const res = await apiFetch(`${API}/api/cha/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const created = await res.json();
      setRecords((r) => [...r, created].sort((a, b) => a.cha_name.localeCompare(b.cha_name)));
      setShowModal(false);
      setForm(emptyForm());
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    await apiFetch(`${API}/api/cha/${id}`, { method: "DELETE" });
    setRecords((r) => r.filter((x) => x.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <div>
          <p style={{ margin: "0 0 2px", fontSize: "11px", fontFamily: "var(--font-mono), monospace", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.06em" }}>Masters</p>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b" }}>CHA</h1>
        </div>
        <button style={btnStyle("primary")} onClick={() => setShowModal(true)}>+ Add CHA</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th style={TH}>#</th>
              {COLS.map((c) => <th key={c.key} style={TH}>{c.label}</th>)}
              <th style={{ ...TH, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={COLS.length + 2} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>No CHA records yet</td></tr>
            ) : records.map((rec, i) => (
              <tr key={rec.id}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>{String(i + 1).padStart(3, "0")}</td>
                <td style={TD}>{rec.cha_name}</td>
                <td style={TD}>{rec.agent_name ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{rec.cha_charges ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{rec.date ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={{ ...TD, textAlign: "right" }}>
                  <button style={btnStyle("danger")} onClick={() => handleDelete(rec.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "420px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>Add CHA</h2>
            {[
              { key: "cha_name",    label: "CHA Name",    type: "text" },
              { key: "agent_name",  label: "Agent Name",  type: "text" },
              { key: "cha_charges", label: "CHA Charges", type: "text" },
              { key: "date",        label: "Date",        type: "date" },
            ].map((f) => (
              <label key={f.key} style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                {f.label}
                <input type={f.type} style={inputStyle} placeholder={f.label}
                  value={form[f.key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
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
