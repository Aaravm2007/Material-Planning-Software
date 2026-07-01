"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { API } from "@/lib/apiFetch";

type Role = "user" | "expert";

interface RoleContextType {
  role: Role;
  email: string;
  loading: boolean;
}

const RoleContext = createContext<RoleContextType>({
  role: "user",
  email: "",
  loading: true,
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("user");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/users/me`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setRole(data.role === "expert" ? "expert" : "user");
          setEmail(data.email ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <RoleContext.Provider value={{ role, email, loading }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
