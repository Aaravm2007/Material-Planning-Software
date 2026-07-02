"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect } from "react";
import { usePolling } from "@/lib/usePolling";

interface Port { id: number; name: string; }


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

const TH: React.CSSProperties = {
  padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600,
  letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b",
  background: "#fafafa", borderBottom: "1px solid #e4e4e7", whiteSpace: "nowrap",
};
const TD: React.CSSProperties = {
  padding: "10px 16px", fontSize: "14px", borderBottom: "1px solid #f4f4f5",
  color: "#09090b", whiteSpace: "nowrap",
};

export default function PortsClient({ initialPorts }: { initialPorts: Port[] }) {
  const [ports, setPorts] = useState<Port[]>(initialPorts);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  function fetchPorts() {
    apiFetch(`${API}/api/ports/`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setPorts(Array.isArray(data) ? data : []));
  }
  useEffect(() => { fetchPorts(); }, []);
  usePolling(fetchPorts, 10_000);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    const res = await apiFetch(`${API}/api/ports/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      const created = await res.json();
      setPorts((p) => [...p, created].sort((a, b) => a.name.localeCompare(b.name)));
      setShowModal(false);
      setName("");
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    await apiFetch(`${API}/api/ports/${id}`, { method: "DELETE" });
    setPorts((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <div>
          <p style={{ margin: "0 0 2px", fontSize: "11px", fontFamily: "var(--font-mono), monospace", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.06em" }}>Masters</p>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b" }}>Port Selection</h1>
        </div>
        <button style={btnStyle("primary")} onClick={() => setShowModal(true)}>+ Add Port</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th style={TH}>#</th>
              <th style={TH}>Port Name</th>
              <th style={{ ...TH, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ports.length === 0 ? (
              <tr><td colSpan={3} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>No ports yet — click Add Port</td></tr>
            ) : ports.map((p, i) => (
              <tr key={p.id}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>{String(i + 1).padStart(3, "0")}</td>
                <td style={TD}>{p.name}</td>
                <td style={{ ...TD, textAlign: "right" }}>
                  <button style={btnStyle("danger")} onClick={() => handleDelete(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "360px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>Add Port</h2>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Port Name *
              <input style={{ ...inputStyle, width: "100%" }} placeholder="e.g. Mumbai" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
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
