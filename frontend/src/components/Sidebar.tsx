"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRole } from "./RoleContext";
import { API } from "@/lib/apiFetch";

const NAV = [
  { label: "Master Table",    href: "/master-table"    },
  { label: "Order Planning",  href: "/order-planning"  },
  { label: "PO / PI",         href: "/po-pi"           },
  { label: "Import Planning", href: "/import-planning" },
  { label: "BOE",             href: "/boe"             },
  { label: "Transportation",  href: "/transportation"  },
  { label: "Due Date",        href: "/due-date"        },
];

const REPORTS_NAV = [
  { label: "Material Plan",  href: "/material-plan"  },
  { label: "Payment Plan",   href: "/payment-plan"   },
];

const MASTERS_NAV = [
  { label: "Suppliers",          href: "/masters/suppliers"      },
  { label: "Shipping Companies", href: "/masters/shipping-lines" },
  { label: "Port Selection",     href: "/masters/ports"          },
  { label: "CHA",                href: "/masters/cha"            },
  { label: "Hedging",            href: "/masters/hedging"        },
  { label: "Credit",             href: "/masters/credit"         },
];

type ServerStatus = "checking" | "online" | "offline";

function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch(`${API}/health`, { credentials: "include", cache: "no-store" });
        if (!cancelled) setStatus(res.ok ? "online" : "offline");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    }
    check();
    const id = setInterval(check, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return status;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { role, setRole } = useRole();
  const serverStatus = useServerStatus();

  const linkStyle = (href: string, indent = false): React.CSSProperties => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return {
      display: "block",
      padding: indent ? "6px 12px 6px 22px" : "7px 12px",
      marginBottom: "2px",
      borderRadius: "7px",
      fontSize: indent ? "12px" : "13px",
      fontFamily: "var(--font-sans), sans-serif",
      fontWeight: active ? 600 : 400,
      color: active ? "#09090b" : "#71717a",
      background: active ? "#e4e4e7" : "transparent",
      textDecoration: "none",
    };
  };

  const onEnter = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    if (!active) {
      (e.currentTarget as HTMLElement).style.background = "#f4f4f5";
      (e.currentTarget as HTMLElement).style.color = "#09090b";
    }
  };
  const onLeave = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    if (!active) {
      (e.currentTarget as HTMLElement).style.background = "transparent";
      (e.currentTarget as HTMLElement).style.color = "#71717a";
    }
  };

  return (
    <aside style={{ width: "220px", flexShrink: 0, height: "100%", borderRight: "1px solid #e4e4e7", background: "#fafafa", display: "flex", flexDirection: "column" }}>
      {/* App title */}
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #e4e4e7" }}>
        <span style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "16px", fontWeight: 400, color: "#09090b", letterSpacing: "-0.01em" }}>
          Material Planning
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px", overflow: "auto" }}>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} style={linkStyle(item.href)}
            onMouseEnter={(e) => onEnter(e, item.href)}
            onMouseLeave={(e) => onLeave(e, item.href)}>
            {item.label}
          </Link>
        ))}

        {/* Reports section */}
        <div style={{ marginTop: "12px", marginBottom: "4px", padding: "0 12px", fontSize: "10px", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.08em", textTransform: "uppercase", color: "#a1a1aa" }}>
          Reports
        </div>
        {REPORTS_NAV.map((item) => (
          <Link key={item.href} href={item.href} style={linkStyle(item.href, true)}
            onMouseEnter={(e) => onEnter(e, item.href)}
            onMouseLeave={(e) => onLeave(e, item.href)}>
            {item.label}
          </Link>
        ))}

        {/* Masters section */}
        <div style={{ marginTop: "12px", marginBottom: "4px", padding: "0 12px", fontSize: "10px", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.08em", textTransform: "uppercase", color: "#a1a1aa" }}>
          Masters
        </div>
        {MASTERS_NAV.map((item) => (
          <Link key={item.href} href={item.href} style={linkStyle(item.href, true)}
            onMouseEnter={(e) => onEnter(e, item.href)}
            onMouseLeave={(e) => onLeave(e, item.href)}>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Admin section */}
      <div style={{ padding: "10px 16px 8px", borderTop: "1px solid #e4e4e7" }}>
        <div style={{ fontSize: "10px", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.08em", textTransform: "uppercase", color: "#a1a1aa", marginBottom: "8px" }}>
          Admin
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0,
            background: serverStatus === "online" ? "#22c55e" : serverStatus === "offline" ? "#ef4444" : "#f59e0b",
            boxShadow: serverStatus === "online"
              ? "0 0 0 2px #dcfce7"
              : serverStatus === "offline"
              ? "0 0 0 2px #fee2e2"
              : "0 0 0 2px #fef3c7",
          }} />
          <span style={{ fontSize: "12px", fontFamily: "var(--font-sans), sans-serif", color: "#52525b" }}>
            Server
          </span>
          <span style={{
            marginLeft: "auto", fontSize: "11px",
            fontFamily: "var(--font-mono), monospace",
            color: serverStatus === "online" ? "#16a34a" : serverStatus === "offline" ? "#dc2626" : "#d97706",
          }}>
            {serverStatus === "online" ? "Online" : serverStatus === "offline" ? "Offline" : "…"}
          </span>
        </div>
      </div>

      {/* Role selector */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #e4e4e7" }}>
        <div style={{ fontSize: "10px", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.08em", textTransform: "uppercase", color: "#a1a1aa", marginBottom: "6px" }}>
          Role
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value as "user" | "expert")}
          style={{ width: "100%", padding: "5px 8px", borderRadius: "6px", border: "1px solid #e4e4e7", background: "#ffffff", fontSize: "12px", fontFamily: "var(--font-sans), sans-serif", color: "#09090b", cursor: "pointer", outline: "none" }}>
          <option value="user">User</option>
          <option value="expert">Expert</option>
        </select>
      </div>
    </aside>
  );
}
