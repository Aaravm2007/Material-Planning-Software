"use client";

import { useEffect, useState } from "react";
import { API, apiFetch } from "@/lib/apiFetch";
import { useRole } from "@/components/RoleContext";

interface User { id: number; username: string; email: string | null; role: string; is_blocked: boolean; }

const TH: React.CSSProperties = {
  padding: "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600,
  letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b",
  background: "#fafafa", borderBottom: "1px solid #e4e4e7", whiteSpace: "nowrap",
};
const TD: React.CSSProperties = {
  padding: "11px 16px", fontSize: "13px", borderBottom: "1px solid #f4f4f5",
  color: "#09090b", whiteSpace: "nowrap",
};

export default function AdminClient() {
  const { role: myRole, email: myEmail, loading } = useRole();
  const [users, setUsers] = useState<User[]>([]);
  const [fetching, setFetching] = useState(true);
  const [actioning, setActioning] = useState<{ id: number; action: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (loading) return;
    apiFetch(`${API}/api/users/`)
      .then((r) => r.ok ? r.json() : [])
      .then(setUsers)
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [loading]);

  async function patchUser(user: User, payload: object, action: string) {
    setActioning({ id: user.id, action });
    const res = await apiFetch(`${API}/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((u) => u.map((x) => (x.id === updated.id ? updated : x)));
    }
    setActioning(null);
  }

  async function handleClearDb() {
    setClearing(true);
    const res = await apiFetch(`${API}/api/admin/clear-db`, { method: "DELETE" });
    if (res.ok) {
      const { cleared } = await res.json();
      alert(`Cleared: ${cleared.join(", ")}`);
    }
    setClearing(false);
    setClearConfirm(false);
  }

  async function deleteUser(id: number) {
    setActioning({ id, action: "delete" });
    const res = await apiFetch(`${API}/api/users/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) setUsers((u) => u.filter((x) => x.id !== id));
    setActioning(null);
    setConfirmDelete(null);
  }

  if (loading || fetching) {
    return (
      <div style={{ padding: "40px", color: "#a1a1aa", fontSize: "13px", fontFamily: "var(--font-sans), sans-serif" }}>
        Loading…
      </div>
    );
  }

  if (myRole !== "expert") {
    return (
      <div style={{ padding: "40px", fontFamily: "var(--font-sans), sans-serif" }}>
        <div style={{ fontSize: "14px", color: "#71717a" }}>Access restricted to expert users.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 40px", fontFamily: "var(--font-sans), sans-serif", maxWidth: "800px" }}>
      <div style={{ marginBottom: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b", margin: "0 0 4px" }}>
            User Management
          </h1>
          <p style={{ fontSize: "13px", color: "#71717a", margin: 0 }}>
            Manage access roles for team members. Changes take effect on their next page load.
          </p>
        </div>
        <button
          onClick={async () => {
            await apiFetch(`${API}/api/users/me/signout`, { method: "POST" }).catch(() => {});
            window.location.href = `https://${process.env.NEXT_PUBLIC_CF_TEAM_DOMAIN ?? "orange-truth-1d23.cloudflareaccess.com"}/cdn-cgi/access/logout`;
          }}
          style={{
            padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 500,
            fontFamily: "var(--font-sans), sans-serif", cursor: "pointer",
            border: "1px solid #fecaca", color: "#ef4444", background: "transparent",
          }}
        >
          Sign out
        </button>
      </div>

      <div style={{ border: "1px solid #e4e4e7", borderRadius: "10px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH}>Email</th>
              <th style={TH}>Username</th>
              <th style={TH}>Role</th>
              <th style={{ ...TH, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...TD, color: "#a1a1aa", textAlign: "center", padding: "24px" }}>
                  No users yet.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const isMe = u.email === myEmail;
              return (
                <tr key={u.id} style={{ background: isMe ? "#fafafa" : "transparent" }}>
                  <td style={TD}>
                    <span style={{ color: "#09090b" }}>{u.email ?? <span style={{ color: "#a1a1aa" }}>—</span>}</span>
                    {isMe && (
                      <span style={{ marginLeft: "6px", fontSize: "10px", background: "#e4e4e7", color: "#52525b", padding: "1px 5px", borderRadius: "3px", fontFamily: "var(--font-mono), monospace" }}>
                        you
                      </span>
                    )}
                  </td>
                  <td style={{ ...TD, color: "#52525b" }}>{u.username}</td>
                  <td style={TD}>
                    <span style={{
                      display: "inline-block", padding: "2px 8px", borderRadius: "4px", fontSize: "11px",
                      fontFamily: "var(--font-mono), monospace",
                      background: u.role === "expert" ? "#09090b" : "#f4f4f5",
                      color: u.role === "expert" ? "#ffffff" : "#52525b",
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ ...TD, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {/* Role toggle */}
                      <button
                        disabled={isMe || actioning?.id === u.id}
                        onClick={() => patchUser(u, { role: u.role === "expert" ? "user" : "expert" }, "role")}
                        style={{
                          padding: "5px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 500,
                          fontFamily: "var(--font-sans), sans-serif", cursor: isMe ? "not-allowed" : "pointer",
                          border: "1px solid #e4e4e7", background: "transparent",
                          color: isMe ? "#a1a1aa" : "#09090b",
                          opacity: actioning?.id === u.id && actioning.action === "role" ? 0.5 : 1,
                        }}
                      >
                        {actioning?.id === u.id && actioning.action === "role" ? "Saving…" : u.role === "expert" ? "Demote" : "Promote"}
                      </button>
                      {/* Force sign out */}
                      <button
                        disabled={isMe || actioning?.id === u.id}
                        onClick={() => patchUser(u, { force_reauth: true }, "signout")}
                        style={{
                          padding: "5px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 500,
                          fontFamily: "var(--font-sans), sans-serif", cursor: isMe ? "not-allowed" : "pointer",
                          border: "1px solid #fde68a", background: "transparent", color: isMe ? "#a1a1aa" : "#b45309",
                          opacity: actioning?.id === u.id && actioning.action === "signout" ? 0.5 : 1,
                        }}
                        title="Forces user to sign in again on next request"
                      >
                        {actioning?.id === u.id && actioning.action === "signout" ? "…" : "Force sign out"}
                      </button>
                      {/* Block / Unblock */}
                      <button
                        disabled={isMe || actioning?.id === u.id}
                        onClick={() => patchUser(u, { is_blocked: !u.is_blocked }, "block")}
                        style={{
                          padding: "5px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 500,
                          fontFamily: "var(--font-sans), sans-serif", cursor: isMe ? "not-allowed" : "pointer",
                          border: u.is_blocked ? "1px solid #bbf7d0" : "1px solid #fecaca",
                          background: "transparent", color: isMe ? "#a1a1aa" : u.is_blocked ? "#15803d" : "#ef4444",
                          opacity: actioning?.id === u.id && actioning.action === "block" ? 0.5 : 1,
                        }}
                        title={u.is_blocked ? "Re-enable access" : "Block all future requests"}
                      >
                        {actioning?.id === u.id && actioning.action === "block" ? "…" : u.is_blocked ? "Unblock" : "Block"}
                      </button>
                      {/* Delete */}
                      {confirmDelete === u.id ? (
                        <>
                          <button
                            onClick={() => deleteUser(u.id)}
                            disabled={actioning?.id === u.id}
                            style={{ padding: "5px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid #ef4444", background: "#ef4444", color: "#fff" }}
                          >
                            {actioning?.id === u.id && actioning.action === "delete" ? "…" : "Confirm"}
                          </button>
                          <button onClick={() => setConfirmDelete(null)} style={{ padding: "5px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 500, fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid #e4e4e7", background: "transparent", color: "#71717a" }}>Cancel</button>
                        </>
                      ) : (
                        <button
                          disabled={isMe || actioning?.id === u.id}
                          onClick={() => setConfirmDelete(u.id)}
                          style={{
                            padding: "5px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 500,
                            fontFamily: "var(--font-sans), sans-serif", cursor: isMe ? "not-allowed" : "pointer",
                            border: "1px solid #e4e4e7", background: "transparent", color: isMe ? "#a1a1aa" : "#71717a",
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "12px" }}>
        You cannot change your own role.
      </p>

      {/* Danger Zone */}
      <div style={{ marginTop: "40px", borderTop: "1px solid #fee2e2", paddingTop: "24px" }}>
        <div style={{ marginBottom: "12px" }}>
          <h2 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "16px", fontWeight: 400, color: "#dc2626", margin: "0 0 4px" }}>
            Danger Zone
          </h2>
          <p style={{ fontSize: "12px", color: "#71717a", margin: 0 }}>
            Clears all rows, order plans, BOE entries, and shipping options. Users and master data (suppliers, ports, etc.) are preserved.
          </p>
        </div>
        {!clearConfirm ? (
          <button
            onClick={() => setClearConfirm(true)}
            style={{ padding: "8px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 500, fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid #fecaca", color: "#dc2626", background: "transparent" }}
          >
            Clear database
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 16px", border: "1px solid #fecaca", borderRadius: "10px", background: "#fff5f5" }}>
            <span style={{ fontSize: "13px", color: "#dc2626", flex: 1 }}>
              This will permanently delete all operational data. Are you sure?
            </span>
            <button
              onClick={handleClearDb}
              disabled={clearing}
              style={{ padding: "6px 16px", borderRadius: "7px", fontSize: "13px", fontWeight: 600, fontFamily: "var(--font-sans), sans-serif", cursor: clearing ? "default" : "pointer", border: "none", background: "#dc2626", color: "#fff", opacity: clearing ? 0.6 : 1 }}
            >
              {clearing ? "Clearing…" : "Yes, clear everything"}
            </button>
            <button
              onClick={() => setClearConfirm(false)}
              style={{ padding: "6px 14px", borderRadius: "7px", fontSize: "13px", fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid #e4e4e7", background: "transparent", color: "#71717a" }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
