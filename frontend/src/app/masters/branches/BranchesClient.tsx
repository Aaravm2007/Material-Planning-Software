"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect } from "react";
import { exportToExcel } from "@/lib/exportExcel";
import { usePolling } from "@/lib/usePolling";
import { useDensity } from "@/components/DensityContext";

interface Branch { id: number; name: string; }
interface AllotmentHistoryEntry {
  id: number; uid: string; branch_name: string; model_number: string | null;
  quantity: string | null; min_rate: string | null; max_rate: string | null;
  created_at: string | null; created_by: string | null; pi_number: string | null;
  supplier_name: string | null; rocket_item_code: string | null; port: string | null;
}

const btnStyle = (v: "primary" | "ghost" | "danger"): React.CSSProperties => ({
  padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
  fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid", whiteSpace: "nowrap",
  ...(v === "primary" ? { background: "#09090b", color: "#fff", borderColor: "#09090b" } :
     v === "danger"   ? { background: "transparent", color: "#ef4444", borderColor: "#fecaca" } :
                         { background: "transparent", color: "#71717a", borderColor: "#e4e4e7" }),
});

const inputStyle: React.CSSProperties = {
  padding: "8px 10px", borderRadius: "7px", border: "1px solid #e4e4e7",
  fontSize: "13px", fontFamily: "var(--font-sans), sans-serif", outline: "none",
  background: "#fafafa", color: "#09090b",
};

export default function BranchesClient({ initialBranches }: { initialBranches: Branch[] }) {
  const { compact } = useDensity();
  const TH: React.CSSProperties = {
    padding: compact ? "4px 8px" : "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600,
    letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b",
    background: "#fafafa", borderBottom: "1px solid #b8b8bf", whiteSpace: "nowrap",
  };
  const TD: React.CSSProperties = {
    padding: compact ? "4px 8px" : "10px 16px", fontSize: "14px", borderBottom: "1px solid #d4d4d8",
    color: "#09090b", whiteSpace: "nowrap",
  };
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<AllotmentHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  function fetchBranches() {
    apiFetch(`${API}/api/branches/`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setBranches(Array.isArray(data) ? data : []));
  }
  useEffect(() => { fetchBranches(); }, []);
  usePolling(fetchBranches, 10_000);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    const res = await apiFetch(`${API}/api/branches/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      const created = await res.json();
      setBranches((b) => [...b, created].sort((a, c) => a.name.localeCompare(c.name)));
      setShowModal(false);
      setName("");
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    await apiFetch(`${API}/api/branches/${id}`, { method: "DELETE" });
    setBranches((b) => b.filter((x) => x.id !== id));
  }

  async function toggleHistory(branchName: string) {
    if (expanded === branchName) {
      setExpanded(null);
      return;
    }
    setExpanded(branchName);
    setHistoryLoading(true);
    const res = await apiFetch(`${API}/api/allotments/branch/${encodeURIComponent(branchName)}`);
    const data = res.ok ? await res.json() : [];
    setHistory(Array.isArray(data) ? data : []);
    setHistoryLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <div>
          <p style={{ margin: "0 0 2px", fontSize: "11px", fontFamily: "var(--font-mono), monospace", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.06em" }}>Masters</p>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b" }}>Branches</h1>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button style={btnStyle("ghost")} onClick={() => exportToExcel(branches, "branches", { name: "Branch Name" })}>↓ Export</button>
          <button style={btnStyle("primary")} onClick={() => setShowModal(true)}>+ Add Branch</button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: compact ? undefined : "100%" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th style={TH}>#</th>
              <th style={TH}>Branch Name</th>
              <th style={{ ...TH, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {branches.length === 0 ? (
              <tr><td colSpan={3} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>No branches yet — click Add Branch</td></tr>
            ) : branches.map((b, i) => (
              <>
                <tr key={b.id}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>{String(i + 1).padStart(3, "0")}</td>
                  <td style={TD}>{b.name}</td>
                  <td style={{ ...TD, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button style={btnStyle("ghost")} onClick={() => toggleHistory(b.name)}>
                        {expanded === b.name ? "Hide History" : "View History"}
                      </button>
                      <button style={btnStyle("danger")} onClick={() => handleDelete(b.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
                {expanded === b.name && (
                  <tr key={`${b.id}-history`}>
                    <td colSpan={3} style={{ padding: "0", background: "#fafafa", borderBottom: "1px solid #f4f4f5" }}>
                      <div style={{ padding: "14px 20px" }}>
                        {historyLoading ? (
                          <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa" }}>Loading…</p>
                        ) : history.length === 0 ? (
                          <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa" }}>No allotment history for this branch yet.</p>
                        ) : (
                          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px" }}>
                            <thead>
                              <tr>
                                {["PI Number", "Supplier", "Item Code", "Model No", "Port", "Quantity", "Min Rate", "Max Rate", "Date"].map((h) => (
                                  <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#a1a1aa", borderBottom: "1px solid #e4e4e7" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {history.map((h) => (
                                <tr key={h.id}>
                                  <td style={{ padding: "6px 10px", fontFamily: "var(--font-mono), monospace" }}>{h.pi_number ?? "—"}</td>
                                  <td style={{ padding: "6px 10px" }}>{h.supplier_name ?? "—"}</td>
                                  <td style={{ padding: "6px 10px" }}>{h.rocket_item_code ?? "—"}</td>
                                  <td style={{ padding: "6px 10px", fontFamily: "var(--font-mono), monospace" }}>{h.model_number ?? "—"}</td>
                                  <td style={{ padding: "6px 10px" }}>{h.port ?? "—"}</td>
                                  <td style={{ padding: "6px 10px", fontFamily: "var(--font-mono), monospace" }}>{h.quantity ?? "—"}</td>
                                  <td style={{ padding: "6px 10px", fontFamily: "var(--font-mono), monospace" }}>{h.min_rate ?? "—"}</td>
                                  <td style={{ padding: "6px 10px", fontFamily: "var(--font-mono), monospace" }}>{h.max_rate ?? "—"}</td>
                                  <td style={{ padding: "6px 10px", fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#71717a" }}>{h.created_at ? h.created_at.slice(0, 10) : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "360px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>Add Branch</h2>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Branch Name *
              <input style={{ ...inputStyle, width: "100%" }} placeholder="e.g. Pune Branch" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => { setShowModal(false); setName(""); }}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Add"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
