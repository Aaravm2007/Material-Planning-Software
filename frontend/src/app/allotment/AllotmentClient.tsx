"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect, useMemo } from "react";
import { usePolling } from "@/lib/usePolling";

interface Row {
  id: number; uid: string; pi_number: string | null; supplier_name: string | null;
  rocket_item_code: string | null; pi_quantity: string | null; port: string | null;
  estimated_eta: string | null; confirmed_eta: string | null; landing_cost: string | null;
  allotted_qty: string | null; balance: string;
}
interface Port { id: number; name: string; }
interface Branch { id: number; name: string; }

const UNASSIGNED = "Unassigned";

const btnStyle = (v: "primary" | "ghost" | "action"): React.CSSProperties => ({
  padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
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

export default function AllotmentClient({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [ports, setPorts] = useState<Port[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activePort, setActivePort] = useState<string>(UNASSIGNED);

  const [allotModal, setAllotModal] = useState<Row | null>(null);
  const [form, setForm] = useState({ branch_name: "", quantity: "", min_rate: "", max_rate: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchRows() {
    const res = await apiFetch(`${API}/api/allotments/stage`);
    if (res.ok) setRows(await res.json());
  }
  useEffect(() => { fetchRows(); }, []);
  usePolling(fetchRows, 10_000);

  useEffect(() => {
    apiFetch(`${API}/api/ports/`).then((r) => r.ok ? r.json() : []).then((d) => setPorts(Array.isArray(d) ? d : []));
    apiFetch(`${API}/api/branches/`).then((r) => r.ok ? r.json() : []).then((d) => setBranches(Array.isArray(d) ? d : []));
  }, []);

  const tabs = useMemo(() => [...ports.map((p) => p.name), UNASSIGNED], [ports]);

  const rowsByTab = useMemo(() => {
    const portNames = new Set(ports.map((p) => p.name));
    const map: Record<string, Row[]> = {};
    for (const r of rows) {
      const key = r.port && portNames.has(r.port) ? r.port : UNASSIGNED;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [rows, ports]);

  const activeRows = rowsByTab[activePort] ?? [];

  function openAllot(row: Row) {
    setAllotModal(row);
    setForm({ branch_name: "", quantity: "", min_rate: "", max_rate: "" });
    setError(null);
  }

  async function handleSubmit() {
    if (!allotModal) return;
    const qty = parseFloat(form.quantity) || 0;
    const balance = parseFloat(allotModal.balance) || 0;
    if (!form.branch_name) { setError("Select a branch."); return; }
    if (qty <= 0 || qty > balance + 0.0001) { setError(`Quantity must be greater than 0 and no more than the remaining ${balance.toFixed(2)}.`); return; }
    setSaving(true);
    setError(null);
    const res = await apiFetch(`${API}/api/allotments/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: allotModal.uid, branch_name: form.branch_name, quantity: form.quantity,
        min_rate: form.min_rate || null, max_rate: form.max_rate || null,
      }),
    });
    if (res.ok) {
      setAllotModal(null);
      fetchRows();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.detail ?? "Failed to save the allotment. Please try again.");
    }
    setSaving(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b", margin: 0 }}>Allotment</h1>
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa", textTransform: "uppercase" }}>{rows.length} rows</span>
      </div>

      <div style={{ flexShrink: 0, display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button key={t} onClick={() => setActivePort(t)}
            style={{
              padding: "7px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
              fontFamily: "var(--font-sans), sans-serif", cursor: "pointer",
              border: `1px solid ${t === activePort ? "#09090b" : "#e4e4e7"}`,
              background: t === activePort ? "#09090b" : "#fff",
              color: t === activePort ? "#fff" : "#71717a",
            }}>
            {t} <span style={{ opacity: 0.7 }}>({(rowsByTab[t] ?? []).length})</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th style={TH}>#</th>
              <th style={TH}>PI Number</th>
              <th style={TH}>Supplier Name</th>
              <th style={TH}>Rocket Item Code</th>
              <th style={TH}>Quantity</th>
              <th style={TH}>Allotted Qty</th>
              <th style={TH}>Balance</th>
              <th style={TH}>ETA</th>
              <th style={TH}>Port</th>
              <th style={TH}>Landing Cost</th>
              <th style={{ ...TH, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.length === 0 ? (
              <tr><td colSpan={11} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>No rows in this port</td></tr>
            ) : activeRows.map((row, i) => (
              <tr key={row.uid}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>{String(i + 1).padStart(3, "0")}</td>
                <td style={TD}>{row.pi_number || <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={TD}>{row.supplier_name || <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={TD}>{row.rocket_item_code || <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.pi_quantity || "—"}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.allotted_qty || "0"}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontWeight: 600 }}>{row.balance}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.confirmed_eta || row.estimated_eta || "—"}</td>
                <td style={TD}>{row.port || <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.landing_cost || "—"}</td>
                <td style={{ ...TD, textAlign: "right" }}>
                  <button style={btnStyle("action")} onClick={() => openAllot(row)}>Allot</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {allotModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "420px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400 }}>Allot Quantity</h2>
            <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa", fontFamily: "var(--font-mono), monospace" }}>
              {allotModal.pi_number ?? "—"} — Remaining {parseFloat(allotModal.balance).toFixed(2)}
            </p>

            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
              Branch Name
              <select style={inputStyle} value={form.branch_name} onChange={(e) => setForm((f) => ({ ...f, branch_name: e.target.value }))}>
                <option value="">— select branch —</option>
                {branches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </label>

            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
              Quantity
              <input type="text" style={inputStyle} placeholder="Quantity" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
            </label>

            <div style={{ display: "flex", gap: "10px" }}>
              <label style={{ flex: 1, fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                Min Rate
                <input type="text" style={inputStyle} placeholder="Min Rate" value={form.min_rate} onChange={(e) => setForm((f) => ({ ...f, min_rate: e.target.value }))} />
              </label>
              <label style={{ flex: 1, fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                Max Rate
                <input type="text" style={inputStyle} placeholder="Max Rate" value={form.max_rate} onChange={(e) => setForm((f) => ({ ...f, max_rate: e.target.value }))} />
              </label>
            </div>

            {error && <p style={{ margin: 0, fontSize: "12px", color: "#ef4444" }}>{error}</p>}

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => setAllotModal(null)}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Allot"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
