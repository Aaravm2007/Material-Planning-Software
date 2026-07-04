"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect } from "react";
import { usePolling } from "@/lib/usePolling";
import { useRouter } from "next/navigation";
import AmountInput from "@/components/AmountInput";
import { exportToExcel } from "@/lib/exportExcel";

interface Plan {
  id: number;
  uid: string | null;
  supplier_name: string;
  supplier_model_number: string | null;
  quantity: string | null;
  rate: string | null;
  target_date: string | null;
  remark: string | null;
  created_at: string;
  ordered_quantity: string | null;
  quantity_diff: string | null;
}
interface Supplier { id: number; supplier_name: string; supplier_code: string; }


const PO_PI_DIALOG_FIELDS = [
  "supplier_name", "supplier_code",
  "supplier_model_number", "rocket_item_code",
  "po_number", "pi_number",
  "date_of_po", "pi_date",
  "pi_quantity", "pi_rate",
  "currency", "exchange_rate",
  "confirmed_exworks", "credit_time",
] as const;

const PO_PI_LABELS: Record<string, string> = {
  supplier_name: "Supplier Name", supplier_code: "Supplier Code",
  supplier_model_number: "Supplier Model No", rocket_item_code: "Rocket Item Code",
  po_number: "PO Number", pi_number: "PI Number",
  date_of_po: "Date of PO", pi_date: "PI Date",
  pi_quantity: "PI Quantity", pi_rate: "PI Rate",
  currency: "Currency", exchange_rate: "Exchange Rate",
  confirmed_exworks: "Ex-Works", credit_time: "Credit Time (days)",
};

const DATE_FIELDS = new Set(["date_of_po", "pi_date", "confirmed_exworks"]);

type PoPiForm = Record<string, string> & { pi_total_value: string };

function emptyPoPiForm(): PoPiForm {
  return Object.fromEntries([...PO_PI_DIALOG_FIELDS, "pi_total_value"].map((f) => [f, ""])) as PoPiForm;
}

function calcPiTotal(form: PoPiForm): string {
  const q = parseFloat(form.pi_quantity) || 0;
  const r = parseFloat(form.pi_rate) || 0;
  return q && r ? String(parseFloat((q * r).toFixed(4))) : "";
}

function calcPoTotalInr(form: PoPiForm): string {
  const pi = parseFloat(form.pi_total_value) || 0;
  if (!pi) return "";
  if (form.currency === "INR") return String(pi);
  const rate = parseFloat(form.exchange_rate) || 0;
  return rate ? String(parseFloat((pi * rate).toFixed(4))) : "";
}

const btnStyle = (variant: "primary" | "danger" | "ghost" | "action"): React.CSSProperties => ({
  padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
  fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid", whiteSpace: "nowrap",
  ...(variant === "primary" ? { background: "#09090b", color: "#fff", borderColor: "#09090b" } :
     variant === "danger"   ? { background: "transparent", color: "#ef4444", borderColor: "#fecaca" } :
     variant === "action"   ? { background: "#f4f4f5", color: "#09090b", borderColor: "#e4e4e7" } :
                               { background: "transparent", color: "#71717a", borderColor: "#e4e4e7" }),
});

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: "7px", border: "1px solid #e4e4e7",
  fontSize: "13px", fontFamily: "var(--font-sans), sans-serif", outline: "none", background: "#fafafa", color: "#09090b",
};

const TH: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b", background: "#fafafa", borderBottom: "1px solid #e4e4e7", whiteSpace: "nowrap", fontFamily: "var(--font-sans), sans-serif" };
const TD: React.CSSProperties = { padding: "9px 14px", fontSize: "13px", borderBottom: "1px solid #f4f4f5", fontFamily: "var(--font-sans), sans-serif", color: "#09090b", whiteSpace: "nowrap" };

const COLS = [
  { key: "supplier_name",          label: "Supplier"        },
  { key: "supplier_model_number",  label: "Model No."       },
  { key: "quantity",               label: "Planned Qty"     },
  { key: "ordered_quantity",       label: "Ordered Qty"     },
  { key: "quantity_diff",          label: "Difference"      },
  { key: "rate",                   label: "Rate"            },
  { key: "target_date",            label: "Target Date"     },
  { key: "remark",                 label: "Remarks"         },
  { key: "created_at",             label: "Created"         },
];

function fmtDate(s: string | null) {
  if (!s) return null;
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}

export default function OrderPlanningClient({ initialPlans }: { initialPlans: Plan[] }) {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ supplier_name: "", supplier_model_number: "", quantity: "", rate: "", target_date: "", remark: "" });
  const [createModels, setCreateModels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [poPiModal, setPoPiModal] = useState<Plan | null>(null);
  const [poPiForm, setPoPiForm] = useState<PoPiForm>(emptyPoPiForm());
  const [poPiSaving, setPoPiSaving] = useState(false);
  const [selectedPoPiSupplier, setSelectedPoPiSupplier] = useState<Supplier | null>(null);
  const [poPiModels, setPoPiModels] = useState<string[]>([]);
  const [newModelModal, setNewModelModal] = useState(false);

  async function fetchPlans() {
    const res = await apiFetch(`${API}/api/order-plans/`);
    if (res.ok) setPlans(await res.json());
  }

  useEffect(() => {
    fetchPlans();
    apiFetch(`${API}/api/suppliers/`).then((r) => r.ok ? r.json() : []).then((d) => setSuppliers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  usePolling(fetchPlans, 10_000);

  async function fetchCreateModels(supplierName: string) {
    const match = suppliers.find((s) => s.supplier_name === supplierName);
    if (!match) { setCreateModels([]); return; }
    try {
      const res = await apiFetch(`${API}/api/suppliers/${match.id}/models`);
      const data = res.ok ? await res.json() : [];
      setCreateModels(Array.isArray(data) ? data.map((m: { model_number: string }) => m.model_number) : []);
    } catch { setCreateModels([]); }
  }

  async function fetchPoPiModels(supplier: Supplier) {
    try {
      const res = await apiFetch(`${API}/api/suppliers/${supplier.id}/models`);
      const data = res.ok ? await res.json() : [];
      setPoPiModels(Array.isArray(data) ? data.map((m: { model_number: string }) => m.model_number) : []);
    } catch { setPoPiModels([]); }
  }

  async function handleCreate() {
    if (!form.supplier_name) return;
    setSaving(true);
    const body: Record<string, string> = { supplier_name: form.supplier_name };
    if (form.supplier_model_number.trim()) body.supplier_model_number = form.supplier_model_number.trim();
    if (form.quantity.trim()) body.quantity = form.quantity.trim();
    if (form.rate.trim()) body.rate = form.rate.trim();
    if (form.target_date) body.target_date = form.target_date;
    if (form.remark.trim()) body.remark = form.remark.trim();
    const res = await apiFetch(`${API}/api/order-plans/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) {
      const created = await res.json();
      setPlans((p) => [created, ...p]);
      setShowModal(false);
      setForm({ supplier_name: "", supplier_model_number: "", quantity: "", rate: "", target_date: "", remark: "" });
      setCreateModels([]);
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    await apiFetch(`${API}/api/order-plans/${id}`, { method: "DELETE" });
    setPlans((p) => p.filter((x) => x.id !== id));
  }

  function openPoPiModal(plan: Plan) {
    const prefilled = emptyPoPiForm();
    prefilled.supplier_name = plan.supplier_name;
    // pre-fill PI fields from plan quantity/rate
    if (plan.quantity) prefilled.pi_quantity = plan.quantity;
    if (plan.rate) prefilled.pi_rate = plan.rate;
    const match = suppliers.find((s) => s.supplier_name === plan.supplier_name) ?? null;
    if (match) { prefilled.supplier_code = match.supplier_code; fetchPoPiModels(match); }
    setSelectedPoPiSupplier(match);
    // compute pi_total_value from prefilled qty/rate
    prefilled.pi_total_value = calcPiTotal(prefilled);
    setPoPiForm(prefilled);
    setPoPiModal(plan);
  }

  function handlePoPiSupplierChange(name: string) {
    const match = suppliers.find((s) => s.supplier_name === name) ?? null;
    setSelectedPoPiSupplier(match);
    if (match) fetchPoPiModels(match); else setPoPiModels([]);
    setPoPiForm((f) => ({ ...f, supplier_name: name, supplier_code: match ? match.supplier_code : f.supplier_code, supplier_model_number: "" }));
  }

  function handlePoPiFieldChange(field: string, value: string) {
    setPoPiForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "pi_quantity" || field === "pi_rate") {
        next.pi_total_value = calcPiTotal(next);
      }
      if (field === "currency" && value === "INR") {
        next.exchange_rate = "";
      }
      return next;
    });
  }

  function handleCreatePoPi() {
    const model = poPiForm.supplier_model_number.trim();
    if (model && selectedPoPiSupplier && !poPiModels.includes(model)) { setNewModelModal(true); return; }
    doCreatePoPi(false);
  }

  async function doCreatePoPi(saveModel: boolean) {
    setPoPiSaving(true);
    if (saveModel && selectedPoPiSupplier && poPiForm.supplier_model_number.trim()) {
      await apiFetch(`${API}/api/suppliers/${selectedPoPiSupplier.id}/models`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_number: poPiForm.supplier_model_number.trim() }),
      });
    }
    const body: Record<string, string | number> = { order_plan_id: poPiModal!.id };
    for (const [k, v] of Object.entries(poPiForm)) if (String(v).trim()) body[k] = String(v).trim();
    const inrTotal = calcPoTotalInr(poPiForm);
    if (poPiForm.pi_total_value) body.pi_total_value = poPiForm.pi_total_value;
    if (inrTotal) body.po_total_value = inrTotal;
    const res = await apiFetch(`${API}/api/rows/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) {
      setPoPiModal(null); setNewModelModal(false); setPoPiForm(emptyPoPiForm());
      setSelectedPoPiSupplier(null); setPoPiModels([]);
      router.push("/po-pi");
    }
    setPoPiSaving(false);
  }

  const inrTotal = calcPoTotalInr(poPiForm);

  function renderPoPiField(f: string) {
    if (f === "supplier_name") return (
      <select style={inputStyle} value={poPiForm[f]} onChange={(e) => handlePoPiSupplierChange(e.target.value)}>
        <option value="">— select supplier —</option>
        {suppliers.map((s) => <option key={s.id} value={s.supplier_name}>{s.supplier_name}</option>)}
      </select>
    );
    if (f === "supplier_code") return (
      <select style={inputStyle} value={poPiForm[f]} onChange={(e) => setPoPiForm((fm) => ({ ...fm, supplier_code: e.target.value }))}>
        <option value="">— select code —</option>
        {suppliers.map((s) => <option key={s.id} value={s.supplier_code}>{s.supplier_code}</option>)}
      </select>
    );
    if (f === "supplier_model_number") return (
      <>
        <input type="text" list="op-model-list" style={inputStyle}
          placeholder={selectedPoPiSupplier ? "Type or pick model…" : "Select supplier first"}
          disabled={!selectedPoPiSupplier} value={poPiForm[f]}
          onChange={(e) => handlePoPiFieldChange(f, e.target.value)} />
        <datalist id="op-model-list">{poPiModels.map((m) => <option key={m} value={m} />)}</datalist>
      </>
    );
    if (f === "currency") return (
      <select style={inputStyle} value={poPiForm.currency} onChange={(e) => handlePoPiFieldChange("currency", e.target.value)}>
        <option value="">— select —</option>
        <option value="USD">USD (US Dollar)</option>
        <option value="INR">INR (Indian Rupee)</option>
        <option value="CNY">CNY (Chinese Yuan)</option>
      </select>
    );
    if (f === "exchange_rate") {
      if (poPiForm.currency === "INR" || !poPiForm.currency) return null;
      return (
        <input type="text" style={inputStyle} placeholder={`Rate: 1 ${poPiForm.currency} = ? INR`}
          value={poPiForm.exchange_rate} onChange={(e) => handlePoPiFieldChange("exchange_rate", e.target.value)} />
      );
    }
    if (f === "credit_time") return (
      <input type="number" min="0" step="1" style={inputStyle} placeholder="Number of days"
        value={poPiForm[f]} onChange={(e) => handlePoPiFieldChange(f, e.target.value)} />
    );
    if (f === "pi_rate") return (
      <AmountInput style={inputStyle} placeholder={PO_PI_LABELS[f]} value={poPiForm[f]}
        currency={poPiForm.currency} onChange={(raw) => handlePoPiFieldChange(f, raw)} />
    );
    return (
      <input type={DATE_FIELDS.has(f) ? "date" : "text"} style={inputStyle}
        placeholder={PO_PI_LABELS[f]} value={poPiForm[f]}
        onChange={(e) => handlePoPiFieldChange(f, e.target.value)} />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b", margin: 0, letterSpacing: "-0.02em" }}>Order Planning</h1>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button style={btnStyle("ghost")} onClick={() => exportToExcel(plans, "order-planning", Object.fromEntries(COLS.map(c => [c.key, c.label])))}>↓ Export</button>
          <button style={btnStyle("primary")} onClick={() => setShowModal(true)}>+ New Order Plan</button>
        </div>
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
            {plans.length === 0 ? (
              <tr><td colSpan={COLS.length + 2} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>No order plans yet</td></tr>
            ) : plans.map((p, i) => (
              <tr key={p.id}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                <td style={{ ...TD, color: "#a1a1aa", fontFamily: "var(--font-mono), monospace", fontSize: "11px" }}>{String(i + 1).padStart(3, "0")}</td>
                <td style={TD}>{p.supplier_name}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{p.supplier_model_number ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{p.quantity ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{p.ordered_quantity ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontWeight: 600, color: (() => { const d = parseFloat(p.quantity_diff ?? ""); return !p.quantity_diff ? "#d4d4d8" : d === 0 ? "#16a34a" : d > 0 ? "#ef4444" : "#f97316"; })() }}>{p.quantity_diff != null ? (parseFloat(p.quantity_diff) > 0 ? "+" : "") + p.quantity_diff : "—"}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{p.rate ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={TD}>{p.target_date ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                <td style={{ ...TD, color: p.remark ? "#09090b" : "#d4d4d8", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>{p.remark ?? "—"}</td>
                <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>{fmtDate(p.created_at)}</td>
                <td style={{ ...TD, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button style={btnStyle("action")} onClick={() => openPoPiModal(p)}>Go to PO/PI →</button>
                    <button style={btnStyle("danger")} onClick={() => handleDelete(p.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Order Plan Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) handleCreate(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "460px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>New Order Plan</h2>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Supplier Name *
              <select style={inputStyle} value={form.supplier_name} onChange={(e) => { setForm({ ...form, supplier_name: e.target.value, supplier_model_number: "" }); fetchCreateModels(e.target.value); }}>
                <option value="">— select supplier —</option>
                {suppliers.map((s) => <option key={s.id} value={s.supplier_name}>{s.supplier_name}</option>)}
              </select>
            </label>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Supplier Model No.
              <input type="text" list="create-model-list" style={inputStyle}
                placeholder={form.supplier_name ? "Type or pick model…" : "Select supplier first"}
                disabled={!form.supplier_name} value={form.supplier_model_number}
                onChange={(e) => setForm({ ...form, supplier_model_number: e.target.value })} />
              <datalist id="create-model-list">{createModels.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                Quantity
                <input type="text" style={inputStyle} placeholder="e.g. 100" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </label>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                Rate
                <input type="text" style={inputStyle} placeholder="e.g. 250.00" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
              </label>
            </div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Target Date
              <input type="date" style={inputStyle} value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
            </label>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Remarks
              <textarea style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }} placeholder="Optional remarks" value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} />
            </label>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => { setShowModal(false); setForm({ supplier_name: "", supplier_model_number: "", quantity: "", rate: "", target_date: "", remark: "" }); setCreateModels([]); }}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* PO/PI Modal */}
      {poPiModal && !newModelModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreatePoPi(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "580px", maxHeight: "85vh", overflow: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>Add PO / PI Row</h2>
              <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa", fontFamily: "var(--font-sans), sans-serif" }}>
                From order plan: <strong style={{ color: "#52525b" }}>{poPiModal.supplier_name}</strong>{poPiModal.target_date ? ` — ${poPiModal.target_date}` : ""}
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {PO_PI_DIALOG_FIELDS.map((f) => {
                const rendered = renderPoPiField(f);
                if (rendered === null) return null;
                return (
                  <label key={f} style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {PO_PI_LABELS[f]}
                    {rendered}
                  </label>
                );
              })}
            </div>

            {/* PI total + INR total display */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                PI Total ({poPiForm.currency || "orig. currency"}) — auto
                <input type="text" style={{ ...inputStyle, background: "#f0f0f0", color: "#52525b" }} value={poPiForm.pi_total_value} readOnly placeholder="Auto-calculated" />
              </label>
              {poPiForm.currency !== "INR" && (
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Total in INR — auto
                  <input type="text" style={{ ...inputStyle, background: "#f0f0f0", color: "#52525b" }} value={inrTotal} readOnly placeholder="PI total × exchange rate" />
                </label>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => { setPoPiModal(null); setPoPiForm(emptyPoPiForm()); setSelectedPoPiSupplier(null); setPoPiModels([]); }}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleCreatePoPi} disabled={poPiSaving}>{poPiSaving ? "Saving…" : "Create & Go to PO/PI →"}</button>
            </div>
          </div>
        </div>
      )}

      {/* New model confirm dialog */}
      {newModelModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") doCreatePoPi(true); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "400px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>New model number</h2>
            <p style={{ margin: 0, fontSize: "14px", fontFamily: "var(--font-sans), sans-serif", color: "#52525b", lineHeight: 1.5 }}>
              <strong style={{ fontFamily: "var(--font-mono), monospace", background: "#f4f4f5", padding: "1px 6px", borderRadius: "4px" }}>{poPiForm.supplier_model_number}</strong>{" "}
              is not in <strong>{selectedPoPiSupplier?.supplier_name}</strong>'s model list. Save it?
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => setNewModelModal(false)}>Cancel</button>
              <button style={btnStyle("action")} onClick={() => doCreatePoPi(false)} disabled={poPiSaving}>Create without saving</button>
              <button style={btnStyle("primary")} onClick={() => doCreatePoPi(true)} disabled={poPiSaving}>{poPiSaving ? "Saving…" : "Save & Create"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
