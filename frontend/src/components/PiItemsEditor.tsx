"use client";

export interface PiItemDraft {
  model_number: string;
  quantity: string;
  rate: string;
}

export function blankItem(): PiItemDraft {
  return { model_number: "", quantity: "", rate: "" };
}

export function itemsTotalQty(items: PiItemDraft[]): number {
  return items.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0), 0);
}

export function itemsTotalValue(items: PiItemDraft[]): number {
  return items.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0), 0);
}

/** Items with a model number entered (what actually gets sent to the API). */
export function nonEmptyItems(items: PiItemDraft[]): PiItemDraft[] {
  return items.filter((it) => it.model_number.trim() !== "");
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #e4e4e7",
  fontSize: "12px", fontFamily: "var(--font-sans), sans-serif", outline: "none", background: "#fff",
};

/** Model-wise PI line items: one row per model number with quantity + rate.
 * Totals are computed by the caller via itemsTotalQty/itemsTotalValue. */
export default function PiItemsEditor({
  items, onChange, models, datalistId, disabled,
}: {
  items: PiItemDraft[];
  onChange: (items: PiItemDraft[]) => void;
  models: string[];
  datalistId: string;
  disabled?: boolean;
}) {
  function update(idx: number, patch: Partial<PiItemDraft>) {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  return (
    <div style={{ border: "1px solid #e4e4e7", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px", background: "#fafafa" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono), monospace" }}>
          Items (model-wise)
        </span>
        <button type="button" disabled={disabled}
          style={{ padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: disabled ? "default" : "pointer", border: "1px solid #e4e4e7", background: "#fff", color: "#09090b", opacity: disabled ? 0.5 : 1 }}
          onClick={() => onChange([...items, blankItem()])}>
          + Add Item
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 24px", gap: "6px", alignItems: "center" }}>
        {["Model No", "Quantity", "Rate", "Total", ""].map((h, i) => (
          <span key={i} style={{ fontSize: "10px", fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
        ))}
        {items.map((it, idx) => {
          const total = (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0);
          return (
            <div key={idx} style={{ display: "contents" }}>
              <input type="text" list={datalistId} style={inputStyle} placeholder="Model number"
                disabled={disabled} value={it.model_number}
                onChange={(e) => update(idx, { model_number: e.target.value })} />
              <input type="text" style={inputStyle} placeholder="Qty"
                disabled={disabled} value={it.quantity}
                onChange={(e) => update(idx, { quantity: e.target.value })} />
              <input type="text" style={inputStyle} placeholder="Rate"
                disabled={disabled} value={it.rate}
                onChange={(e) => update(idx, { rate: e.target.value })} />
              <span style={{ fontSize: "12px", fontFamily: "var(--font-mono), monospace", color: "#52525b", textAlign: "right" }}>
                {total ? total.toFixed(2) : "—"}
              </span>
              <button type="button" disabled={disabled || items.length <= 1}
                style={{ border: "none", background: "none", color: items.length <= 1 ? "#e4e4e7" : "#ef4444", cursor: items.length <= 1 ? "default" : "pointer", fontSize: "13px", padding: 0 }}
                onClick={() => onChange(items.filter((_, i) => i !== idx))}>
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <datalist id={datalistId}>{models.map((m) => <option key={m} value={m} />)}</datalist>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "16px", fontSize: "12px", fontFamily: "var(--font-mono), monospace", color: "#09090b", borderTop: "1px solid #e4e4e7", paddingTop: "8px" }}>
        <span>Total Qty: <strong>{itemsTotalQty(items) || "—"}</strong></span>
        <span>Total Value: <strong>{itemsTotalValue(items) ? itemsTotalValue(items).toFixed(2) : "—"}</strong></span>
      </div>
    </div>
  );
}
