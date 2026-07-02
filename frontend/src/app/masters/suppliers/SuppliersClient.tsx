"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect } from "react";

interface Supplier { id: number; supplier_name: string; supplier_code: string; }
interface SupplierModel { id: number; model_number: string; }


const btnStyle = (v: "primary" | "ghost" | "danger" | "action"): React.CSSProperties => ({
  padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
  fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid", whiteSpace: "nowrap",
  ...(v === "primary" ? { background: "#09090b", color: "#fff", borderColor: "#09090b" } :
     v === "danger"   ? { background: "transparent", color: "#ef4444", borderColor: "#fecaca" } :
     v === "action"   ? { background: "#f4f4f5", color: "#09090b", borderColor: "#e4e4e7" } :
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
  padding: "10px 16px", fontSize: "14px", borderBottom: "1px solid #f4f4f5",
  color: "#09090b", whiteSpace: "nowrap",
};

export default function SuppliersClient({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ supplier_name: "", supplier_code: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    apiFetch(`${API}/api/suppliers/`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setSuppliers(Array.isArray(data) ? data : []));
  }, []);

  // Models panel
  const [modelsSupplier, setModelsSupplier] = useState<Supplier | null>(null);
  const [models, setModels] = useState<SupplierModel[]>([]);
  const [newModel, setNewModel] = useState("");
  const [modelSaving, setModelSaving] = useState(false);

  async function handleCreate() {
    if (!form.supplier_name.trim() || !form.supplier_code.trim()) return;
    setSaving(true);
    setSaveError("");
    const res = await apiFetch(`${API}/api/suppliers/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (res.ok) {
      const created = await res.json();
      setSuppliers((s) => [...s, created].sort((a, b) => a.supplier_name.localeCompare(b.supplier_name)));
      setShowModal(false);
      setForm({ supplier_name: "", supplier_code: "" });
    } else {
      const err = await res.json().catch(() => ({}));
      setSaveError(err.detail ?? `Error ${res.status}`);
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    await apiFetch(`${API}/api/suppliers/${id}`, { method: "DELETE" });
    setSuppliers((s) => s.filter((x) => x.id !== id));
    if (modelsSupplier?.id === id) setModelsSupplier(null);
  }

  async function openModels(supplier: Supplier) {
    setModelsSupplier(supplier);
    setNewModel("");
    const res = await apiFetch(`${API}/api/suppliers/${supplier.id}/models`);
    const data = res.ok ? await res.json() : [];
    setModels(Array.isArray(data) ? data : []);
  }

  async function handleAddModel() {
    if (!newModel.trim() || !modelsSupplier) return;
    setModelSaving(true);
    const res = await apiFetch(`${API}/api/suppliers/${modelsSupplier.id}/models`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_number: newModel.trim() }),
    });
    if (res.ok) {
      const created = await res.json();
      setModels((m) => [...m, created].sort((a, b) => a.model_number.localeCompare(b.model_number)));
      setNewModel("");
    }
    setModelSaving(false);
  }

  async function handleDeleteModel(id: number) {
    await apiFetch(`${API}/api/suppliers/${modelsSupplier!.id}/models/${id}`, { method: "DELETE" });
    setModels((m) => m.filter((x) => x.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <div>
          <p style={{ margin: "0 0 2px", fontSize: "11px", fontFamily: "var(--font-mono), monospace", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.06em" }}>Masters</p>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b" }}>Suppliers</h1>
        </div>
        <button style={btnStyle("primary")} onClick={() => setShowModal(true)}>+ Add Supplier</button>
      </div>

      {/* Two-panel layout when models panel is open */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "grid", gridTemplateColumns: modelsSupplier ? "1fr 340px" : "1fr", gap: "12px" }}>
        {/* Suppliers table */}
        <div style={{ overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead className="sticky top-0 z-10">
              <tr>
                <th style={TH}>#</th>
                <th style={TH}>Supplier Name</th>
                <th style={TH}>Supplier Code</th>
                <th style={{ ...TH, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr><td colSpan={4} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>No suppliers yet — click Add Supplier</td></tr>
              ) : suppliers.map((s, i) => {
                const isActive = modelsSupplier?.id === s.id;
                return (
                  <tr key={s.id}
                    style={{ background: isActive ? "#f4f4f5" : "#fff" }}
                    onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "#fafafa"; }}
                    onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "#fff"; }}>
                    <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>{String(i + 1).padStart(3, "0")}</td>
                    <td style={TD}>{s.supplier_name}</td>
                    <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{s.supplier_code}</td>
                    <td style={{ ...TD, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <button style={{ ...btnStyle(isActive ? "primary" : "action"), fontSize: "11px", padding: "4px 10px" }} onClick={() => isActive ? setModelsSupplier(null) : openModels(s)}>
                          {isActive ? "✕ Close" : "Models"}
                        </button>
                        <button style={btnStyle("danger")} onClick={() => handleDelete(s.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Model numbers panel */}
        {modelsSupplier && (
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "12px", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e4e4e7", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontSize: "10px", fontFamily: "var(--font-mono), monospace", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.06em" }}>Model Numbers</p>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, fontFamily: "var(--font-sans), sans-serif", color: "#09090b" }}>{modelsSupplier.supplier_name}</p>
              </div>
              <span style={{ fontSize: "11px", fontFamily: "var(--font-mono), monospace", color: "#a1a1aa" }}>{models.length}</span>
            </div>

            {/* Add model input */}
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #e4e4e7", display: "flex", gap: "8px" }}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddModel(); }}>
              <input
                style={{ ...inputStyle, padding: "6px 10px", fontSize: "12px" }}
                placeholder="New model number…"
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                autoFocus
              />
              <button style={{ ...btnStyle("primary"), padding: "6px 12px", fontSize: "12px" }} onClick={handleAddModel} disabled={modelSaving}>
                {modelSaving ? "…" : "Add"}
              </button>
            </div>

            {/* Model list */}
            <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              {models.length === 0 ? (
                <p style={{ textAlign: "center", color: "#d4d4d8", fontFamily: "var(--font-sans), sans-serif", fontSize: "13px", padding: "32px 16px" }}>No models yet</p>
              ) : models.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #f4f4f5" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                  <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "13px", color: "#09090b" }}>{m.model_number}</span>
                  <button
                    onClick={() => handleDeleteModel(m.id)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "12px", color: "#d4d4d8", padding: "2px 6px", borderRadius: "4px" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#d4d4d8"; }}
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Supplier Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "400px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>Add Supplier</h2>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Supplier Name *
              <input style={inputStyle} placeholder="Supplier name" value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} />
            </label>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Supplier Code *
              <input style={inputStyle} placeholder="Supplier code" value={form.supplier_code} onChange={(e) => setForm({ ...form, supplier_code: e.target.value })} />
            </label>
            {saveError && (
              <p style={{ margin: 0, fontSize: "12px", color: "#ef4444", fontFamily: "var(--font-sans), sans-serif" }}>
                {saveError}
              </p>
            )}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => { setShowModal(false); setForm({ supplier_name: "", supplier_code: "" }); setSaveError(""); }}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Add"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
