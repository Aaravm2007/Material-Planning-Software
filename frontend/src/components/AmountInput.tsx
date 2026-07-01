"use client";

import { useState } from "react";

interface Props {
  value: string;
  onChange: (rawValue: string) => void;
  style?: React.CSSProperties;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  currency?: string; // "USD" | "CNY" → en-US format; anything else → en-IN
}

function formatAmount(raw: string, currency?: string): string {
  const clean = raw.replace(/,/g, "");
  const num = parseFloat(clean);
  if (isNaN(num) || clean === "") return raw;
  const locale = currency === "USD" || currency === "CNY" ? "en-US" : "en-IN";
  return num.toLocaleString(locale, { maximumFractionDigits: 2 });
}

export default function AmountInput({ value, onChange, style, placeholder, disabled, readOnly, currency }: Props) {
  const [focused, setFocused] = useState(false);
  const displayValue = focused || !value ? value : formatAmount(value, currency);

  return (
    <input
      type="text"
      inputMode="decimal"
      style={style}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      value={displayValue}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value.replace(/,/g, ""))}
    />
  );
}
