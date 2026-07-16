"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect } from "react";
import { exportToExcel } from "@/lib/exportExcel";
import { usePolling } from "@/lib/usePolling";
import { useDensity } from "@/components/DensityContext";

interface ShippingLine { id: number; name: string; }
interface Agent { id: number; agent_name: string; }
interface Freight { id: number; date: string; freight_charge: string; }

type PanelMode = "agents" | "freight";


const btnStyle = (v: "primary" | "ghost" | "danger" | "action" | "active"): React.CSSProperties => ({
  padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
  fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid", whiteSpace: "nowrap",
  ...(v === "primary" ? { background: "#09090b", color: "#fff", borderColor: "#09090b" } :
     v === "active"   ? { background: "#09090b", color: "#fff", borderColor: "#09090b" } :
     v === "danger"   ? { background: "transparent", color: "#ef4444", borderColor: "#fecaca" } :
     v === "action"   ? { background: "#f4f4f5", color: "#09090b", borderColor: "#e4e4e7" } :
                         { background: "transparent", color: "#71717a", borderColor: "#e4e4e7" }),
});

const inputStyle: React.CSSProperties = {
  padding: "6px 10px", borderRadius: "7px", border: "1px solid #e4e4e7",
  fontSize: "12px", fontFamily: "var(--font-sans), sans-serif", outline: "none",
  background: "#fafafa", color: "#09090b",
};

export default function ShippingLinesClient({ initialLines }: { initialLines: ShippingLine[] }) {
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
  const [lines, setLines] = useState<ShippingLine[]>(initialLines);
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);

  function fetchLines() {
    apiFetch(`${API}/api/shipping-lines/`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setLines(Array.isArray(data) ? data : []));
  }
  useEffect(() => { fetchLines(); }, []);
  usePolling(fetchLines, 10_000);

  const [activeLine, setActiveLine] = useState<ShippingLine | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("agents");

  // Agents state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [newAgent, setNewAgent] = useState("");
  const [agentSaving, setAgentSaving] = useState(false);

  // Freight state
  const [freights, setFreights] = useState<Freight[]>([]);
  const [freightForm, setFreightForm] = useState({ date: "", freight_charge: "" });
  const [freightSaving, setFreightSaving] = useState(false);

  async function handleCreate() {
    if (!formName.trim()) return;
    setSaving(true);
    const res = await apiFetch(`${API}/api/shipping-lines/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formName.trim() }),
    });
    if (res.ok) {
      const created = await res.json();
      setLines((l) => [...l, created].sort((a, b) => a.name.localeCompare(b.name)));
      setShowModal(false);
      setFormName("");
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    await apiFetch(`${API}/api/shipping-lines/${id}`, { method: "DELETE" });
    setLines((l) => l.filter((x) => x.id !== id));
    if (activeLine?.id === id) setActiveLine(null);
  }

  async function openPanel(line: ShippingLine, mode: PanelMode) {
    setActiveLine(line);
    setPanelMode(mode);
    setNewAgent("");
    setFreightForm({ date: "", freight_charge: "" });
    if (mode === "agents") {
      const res = await apiFetch(`${API}/api/shipping-lines/${line.id}/agents`);
      const data = res.ok ? await res.json() : [];
      setAgents(Array.isArray(data) ? data : []);
    } else {
      const res = await apiFetch(`${API}/api/shipping-lines/${line.id}/freights`);
      const data = res.ok ? await res.json() : [];
      setFreights(Array.isArray(data) ? data : []);
    }
  }

  async function switchMode(mode: PanelMode) {
    if (!activeLine || mode === panelMode) return;
    setPanelMode(mode);
    setNewAgent("");
    setFreightForm({ date: "", freight_charge: "" });
    if (mode === "agents") {
      const res = await apiFetch(`${API}/api/shipping-lines/${activeLine.id}/agents`);
      const data = res.ok ? await res.json() : [];
      setAgents(Array.isArray(data) ? data : []);
    } else {
      const res = await apiFetch(`${API}/api/shipping-lines/${activeLine.id}/freights`);
      const data = res.ok ? await res.json() : [];
      setFreights(Array.isArray(data) ? data : []);
    }
  }

  async function handleAddAgent() {
    if (!newAgent.trim() || !activeLine) return;
    setAgentSaving(true);
    const res = await apiFetch(`${API}/api/shipping-lines/${activeLine.id}/agents`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_name: newAgent.trim() }),
    });
    if (res.ok) {
      const created = await res.json();
      setAgents((a) => [...a, created].sort((x, y) => x.agent_name.localeCompare(y.agent_name)));
      setNewAgent("");
    }
    setAgentSaving(false);
  }

  async function handleDeleteAgent(id: number) {
    await apiFetch(`${API}/api/shipping-lines/${activeLine!.id}/agents/${id}`, { method: "DELETE" });
    setAgents((a) => a.filter((x) => x.id !== id));
  }

  async function handleAddFreight() {
    if (!freightForm.date || !freightForm.freight_charge.trim() || !activeLine) return;
    setFreightSaving(true);
    const res = await apiFetch(`${API}/api/shipping-lines/${activeLine.id}/freights`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(freightForm),
    });
    if (res.ok) {
      const created = await res.json();
      setFreights((f) => [created, ...f]);
      setFreightForm({ date: "", freight_charge: "" });
    }
    setFreightSaving(false);
  }

  async function handleDeleteFreight(id: number) {
    await apiFetch(`${API}/api/shipping-lines/${activeLine!.id}/freights/${id}`, { method: "DELETE" });
    setFreights((f) => f.filter((x) => x.id !== id));
  }

  const panelOpen = !!activeLine;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <div>
          <p style={{ margin: "0 0 2px", fontSize: "11px", fontFamily: "var(--font-mono), monospace", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.06em" }}>Masters</p>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b" }}>Shipping Companies</h1>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button style={btnStyle("ghost")} onClick={() => exportToExcel(lines, "shipping-companies", { name: "Shipping Company" })}>↓ Export</button>
          <button style={btnStyle("primary")} onClick={() => setShowModal(true)}>+ Add Shipping Company</button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "grid", gridTemplateColumns: panelOpen ? "1fr 340px" : "1fr", gap: "12px" }}>
        {/* Shipping lines table */}
        <div style={{ overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead className="sticky top-0 z-10">
              <tr>
                <th style={TH}>#</th>
                <th style={TH}>Shipping Company Name</th>
                <th style={{ ...TH, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr><td colSpan={3} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>No shipping lines yet</td></tr>
              ) : lines.map((sl, i) => {
                const isActive = activeLine?.id === sl.id;
                return (
                  <tr key={sl.id}
                    style={{ background: isActive ? "#f4f4f5" : "#fff" }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "#fafafa"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isActive ? "#f4f4f5" : "#fff"; }}>
                    <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>{String(i + 1).padStart(3, "0")}</td>
                    <td style={TD}>{sl.name}</td>
                    <td style={{ ...TD, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <button
                          style={{ ...btnStyle(isActive && panelMode === "agents" ? "active" : "action"), fontSize: "11px", padding: "4px 10px" }}
                          onClick={() => isActive && panelMode === "agents" ? setActiveLine(null) : openPanel(sl, "agents")}>
                          {isActive && panelMode === "agents" ? "✕ Close" : "Agents"}
                        </button>
                        <button
                          style={{ ...btnStyle(isActive && panelMode === "freight" ? "active" : "action"), fontSize: "11px", padding: "4px 10px" }}
                          onClick={() => isActive && panelMode === "freight" ? setActiveLine(null) : openPanel(sl, "freight")}>
                          {isActive && panelMode === "freight" ? "✕ Close" : "Freight"}
                        </button>
                        <button style={btnStyle("danger")} onClick={() => handleDelete(sl.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Side panel */}
        {panelOpen && activeLine && (
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "12px", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            {/* Panel header with mode tabs */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e4e4e7", background: "#fafafa" }}>
              <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 600, fontFamily: "var(--font-sans), sans-serif", color: "#09090b" }}>{activeLine.name}</p>
              <div style={{ display: "flex", gap: "6px" }}>
                {(["agents", "freight"] as PanelMode[]).map((m) => (
                  <button key={m} onClick={() => switchMode(m)}
                    style={{ padding: "3px 10px", borderRadius: "5px", fontSize: "11px", fontWeight: 600, fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid", textTransform: "capitalize",
                      background: panelMode === m ? "#09090b" : "transparent",
                      color: panelMode === m ? "#fff" : "#71717a",
                      borderColor: panelMode === m ? "#09090b" : "#e4e4e7" }}>
                    {m === "agents" ? "Agents" : "Freight Charges"}
                  </button>
                ))}
              </div>
            </div>

            {/* Agents panel */}
            {panelMode === "agents" && (
              <>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #e4e4e7", display: "flex", gap: "8px" }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddAgent(); }}>
                  <input style={{ ...inputStyle, flex: 1 }} placeholder="New agent name…"
                    value={newAgent} onChange={(e) => setNewAgent(e.target.value)} autoFocus />
                  <button style={{ ...btnStyle("primary"), padding: "6px 12px" }} onClick={handleAddAgent} disabled={agentSaving}>
                    {agentSaving ? "…" : "Add"}
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                  {agents.length === 0 ? (
                    <p style={{ textAlign: "center", color: "#d4d4d8", fontFamily: "var(--font-sans), sans-serif", fontSize: "13px", padding: "32px 16px" }}>No agents yet</p>
                  ) : agents.map((a) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #f4f4f5" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                      <span style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: "13px", color: "#09090b" }}>{a.agent_name}</span>
                      <button onClick={() => handleDeleteAgent(a.id)}
                        style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "12px", color: "#d4d4d8", padding: "2px 6px", borderRadius: "4px" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#d4d4d8"; }}>✕</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Freight panel */}
            {panelMode === "freight" && (
              <>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #e4e4e7", display: "flex", gap: "8px", alignItems: "center" }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddFreight(); }}>
                  <input type="date" style={{ ...inputStyle, flex: 1 }}
                    value={freightForm.date} onChange={(e) => setFreightForm((f) => ({ ...f, date: e.target.value }))} />
                  <input type="text" style={{ ...inputStyle, flex: 1 }} placeholder="Charge"
                    value={freightForm.freight_charge} onChange={(e) => setFreightForm((f) => ({ ...f, freight_charge: e.target.value }))} />
                  <button style={{ ...btnStyle("primary"), padding: "6px 12px" }} onClick={handleAddFreight} disabled={freightSaving}>
                    {freightSaving ? "…" : "Add"}
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                  {freights.length === 0 ? (
                    <p style={{ textAlign: "center", color: "#d4d4d8", fontFamily: "var(--font-sans), sans-serif", fontSize: "13px", padding: "32px 16px" }}>No freight records yet</p>
                  ) : (
                    <table style={{ borderCollapse: "collapse", width: "100%" }}>
                      <thead>
                        <tr>
                          <th style={{ ...TH, fontSize: "10px", padding: "8px 14px" }}>Date</th>
                          <th style={{ ...TH, fontSize: "10px", padding: "8px 14px" }}>Freight Charge</th>
                          <th style={{ ...TH, fontSize: "10px", padding: "8px 14px", textAlign: "right" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {freights.map((fr) => (
                          <tr key={fr.id}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                            <td style={{ ...TD, fontSize: "12px", padding: "8px 14px", fontFamily: "var(--font-mono), monospace" }}>{fr.date}</td>
                            <td style={{ ...TD, fontSize: "12px", padding: "8px 14px", fontFamily: "var(--font-mono), monospace" }}>{fr.freight_charge}</td>
                            <td style={{ ...TD, padding: "8px 14px", textAlign: "right" }}>
                              <button onClick={() => handleDeleteFreight(fr.id)}
                                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "12px", color: "#d4d4d8", padding: "2px 6px", borderRadius: "4px" }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#d4d4d8"; }}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add Shipping Company Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "380px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>Add Shipping Company</h2>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Shipping Company Name *
              <input style={{ ...inputStyle, width: "100%", padding: "8px 10px", fontSize: "13px" }} placeholder="e.g. Maersk" autoFocus value={formName} onChange={(e) => setFormName(e.target.value)} />
            </label>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => { setShowModal(false); setFormName(""); }}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Add"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
