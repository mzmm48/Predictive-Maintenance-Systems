import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";

type User = {
  username: string;
  role?: string;
};

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  const refreshSession = async () => {
    try {
      const me = await api.auth.me();
      setUser({ username: me.username, role: me.role });
    } catch (err) {
      // 401 => nicht eingeloggt
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Beim App-Start Session prüfen
    refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      await api.auth.login(username, password);
      // Nach Login /auth/me ziehen, damit wir User/Role sicher haben
      const me = await api.auth.me();
      setUser({ username: me.username, role: me.role });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.auth.logout();
    } catch {
      // selbst wenn logout-call fehlschlägt, state resetten
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated, isLoading, login, logout, refreshSession }),
    [user, isAuthenticated, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
