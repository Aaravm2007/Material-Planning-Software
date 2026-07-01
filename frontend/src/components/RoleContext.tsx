"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type Role = "user" | "expert";

interface RoleContextType {
  role: Role;
  setRole: (r: Role) => void;
}

const RoleContext = createContext<RoleContextType>({
  role: "user",
  setRole: () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("user");
  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
