import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { setToken, removeToken, isAuthenticated } from "../services/api";

interface User {
  customerId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "consultant" | "client";
  orgId?: number;
  orgName?: string;
  orgSlug?: string;
  clientCode?: string;
  consultantCode?: string;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = sessionStorage.getItem("timely_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    sessionStorage.setItem("timely_user", JSON.stringify(newUser));
  };

  const logout = () => {
    removeToken();
    setUser(null);
    sessionStorage.removeItem("timely_user");
    localStorage.removeItem("timely_user");
    localStorage.removeItem("timely_authenticated");
    window.location.href = "/";
  };

  const isLoggedIn = user !== null && isAuthenticated();

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;