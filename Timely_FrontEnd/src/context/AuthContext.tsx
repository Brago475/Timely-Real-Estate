import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { setToken, removeToken, isAuthenticated } from "../services/api";

interface User {
  customerId: string;
  name: string;
  email: string;
  role: "admin" | "consultant" | "client";
  clientCode?: string;
  consultantCode?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
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

  const [token, setTokenState] = useState<string | null>(() => {
    return isAuthenticated() ? "exists" : null;
  });

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setTokenState(newToken);
    setUser(newUser);
    sessionStorage.setItem("timely_user", JSON.stringify(newUser));
  };

  const logout = () => {
    removeToken();
    setTokenState(null);
    setUser(null);
    sessionStorage.removeItem("timely_user");
    window.location.href = "/";
  };

  const isLoggedIn = user !== null && isAuthenticated();

  return (
    <AuthContext.Provider value={{ user, token, isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;