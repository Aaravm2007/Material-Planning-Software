"use client";

import { useEffect, useState } from "react";
import { API, apiFetch } from "@/lib/apiFetch";
import { useRole } from "@/components/RoleContext";

interface User { id: number; username: string; email: string | null; role: string; }

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
  const [toggling, setToggling] = useState<number | null>(null);

  useEffect(() => {
    if (loading) return;
    apiFetch(`${API}/api/users/`)
      .then((r) => r.ok ? r.json() : [])
      .then(setUsers)
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [loading]);

  async function toggleRole(user: User) {
    const next = user.role === "expert" ? "user" : "expert";
    setToggling(user.id);
    const res = await apiFetch(`${API}/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: next }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((u) => u.map((x) => (x.id === updated.id ? updated : x)));
    }
    setToggling(null);
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
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b", margin: "0 0 4px" }}>
          User Management
        </h1>
        <p style={{ fontSize: "13px", color: "#71717a", margin: 0 }}>
          Manage access roles for team members. Changes take effect on their next page load.
        </p>
      </div>

      <div style={{ border: "1px solid #e4e4e7", borderRadius: "10px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH}>Email</th>
              <th style={TH}>Username</th>
              <th style={TH}>Role</th>
              <th style={{ ...TH, textAlign: "right" }}>Action</th>
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
                    <button
                      disabled={isMe || toggling === u.id}
                      onClick={() => toggleRole(u)}
                      style={{
                        padding: "5px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 500,
                        fontFamily: "var(--font-sans), sans-serif", cursor: isMe ? "not-allowed" : "pointer",
                        border: "1px solid #e4e4e7", background: "transparent",
                        color: isMe ? "#a1a1aa" : "#09090b",
                        opacity: toggling === u.id ? 0.5 : 1,
                      }}
                    >
                      {toggling === u.id
                        ? "Saving…"
                        : u.role === "expert"
                        ? "Demote to user"
                        : "Promote to expert"}
                    </button>
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
    </div>
  );
}
