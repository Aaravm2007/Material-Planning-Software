"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/apiFetch";

export default function LoginClient() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [loginUrl, setLoginUrl] = useState("");

  useEffect(() => {
    const cfAppDomain = process.env.NEXT_PUBLIC_CF_APP_DOMAIN ?? "mps.rocketlithum.co.in";
    // /auth-redirect is a FastAPI route — CF Access intercepts the unauthenticated
    // request, shows OTP, then after auth redirects back here, which 302s to the frontend.
    setLoginUrl(`https://${cfAppDomain}/auth-redirect`);

    fetch(`${API}/api/rows/?limit=1`, { credentials: "include" })
      .then((res) => {
        if (res.ok) {
          router.replace("/master-table");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#fafafa", fontFamily: "var(--font-sans), sans-serif",
      }}>
        <div style={{ color: "#a1a1aa", fontSize: "13px" }}>Checking session…</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#fafafa", fontFamily: "var(--font-sans), sans-serif",
    }}>
      <div style={{
        background: "#fff", border: "1px solid #e4e4e7", borderRadius: "20px",
        padding: "56px 64px", maxWidth: "420px", width: "100%",
        boxShadow: "0 4px 32px rgba(0,0,0,0.06)", textAlign: "center",
      }}>
        {/* Logo / Brand */}
        <div style={{
          width: "48px", height: "48px", background: "#09090b", borderRadius: "12px",
          margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 12h16M4 18h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>

        <h1 style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "24px", fontWeight: 400, color: "#09090b", margin: "0 0 8px",
        }}>
          Material Planning
        </h1>
        <p style={{ fontSize: "13px", color: "#71717a", margin: "0 0 40px", lineHeight: 1.6 }}>
          Sign in with your <strong>@rocketbatteries.co.in</strong> email to continue.
          A one-time PIN will be sent to your inbox.
        </p>

        <a
          href={loginUrl}
          style={{
            display: "block", padding: "12px 24px", borderRadius: "10px",
            background: "#09090b", color: "#fff", fontSize: "14px", fontWeight: 600,
            textDecoration: "none", border: "1px solid #09090b",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          Send login code →
        </a>

        <p style={{ fontSize: "11px", color: "#a1a1aa", margin: "24px 0 0", lineHeight: 1.6 }}>
          Access is restricted to authorised team members only.
        </p>
      </div>
    </div>
  );
}
