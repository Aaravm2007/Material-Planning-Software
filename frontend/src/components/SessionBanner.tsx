"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { API, apiFetch } from "@/lib/apiFetch";

const COUNTDOWN_SECS = 30;
const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export default function SessionBanner() {
  const pathname = usePathname();
  const [expired, setExpired] = useState(false);
  const [seconds, setSeconds] = useState(COUNTDOWN_SECS);

  function triggerExpiry() {
    setExpired((prev) => {
      if (prev) return prev; // already showing — don't reset countdown
      return true;
    });
  }

  // Listen for session-expired events fired by apiFetch
  useEffect(() => {
    window.addEventListener("session-expired", triggerExpiry);
    return () => window.removeEventListener("session-expired", triggerExpiry);
  }, []);

  // Poll /api/users/me every 2 minutes to catch expiry proactively.
  // Routed through apiFetch so a 401/403 here follows the same rule as any
  // other API call: redirect immediately if never authenticated, otherwise
  // show the countdown banner (via the session-expired listener above).
  useEffect(() => {
    if (pathname.startsWith("/login")) return;
    const id = setInterval(() => {
      apiFetch(`${API}/api/users/me`, { cache: "no-store" });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pathname]);

  // Countdown → redirect
  useEffect(() => {
    if (!expired) return;
    if (seconds <= 0) {
      window.location.href = "/login";
      return;
    }
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [expired, seconds]);

  // Don't show on login page or before expiry
  if (!expired || pathname.startsWith("/login")) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: "#fffbeb", borderBottom: "1px solid #fde68a",
      padding: "10px 20px", display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: "12px",
      fontFamily: "var(--font-sans), sans-serif",
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    }}>
      <span style={{ fontSize: "13px", color: "#92400e" }}>
        Your session has expired — redirecting to login in{" "}
        <strong>{seconds}s</strong>
      </span>
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <a
          href="/login"
          style={{
            padding: "5px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
            background: "#09090b", color: "#fff", textDecoration: "none",
            fontFamily: "var(--font-sans), sans-serif",
          }}
        >
          Re-login now
        </a>
        <button
          onClick={() => { setExpired(false); setSeconds(COUNTDOWN_SECS); }}
          style={{
            padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
            background: "transparent", border: "1px solid #fde68a",
            color: "#92400e", cursor: "pointer",
            fontFamily: "var(--font-sans), sans-serif",
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
