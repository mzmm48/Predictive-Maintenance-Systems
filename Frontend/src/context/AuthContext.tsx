import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../api/client";

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

/**
 * Auth state backed by the backend's HttpOnly cookie session.
 * On app start we call `/auth/me` to restore an existing session (if any).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  const refreshSession = useCallback(async () => {
    try {
      const me = await api.auth.me();
      setUser({ username: me.username, role: me.role });
    } catch {
      // If `/auth/me` fails we treat the user as logged out.
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // On app start, try to restore an existing session.
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      await api.auth.login(username, password);
      // After login fetch `/auth/me` to get username/role from the server.
      const me = await api.auth.me();
      setUser({ username: me.username, role: me.role });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await api.auth.logout();
    } catch {
      // Even if the logout call fails, we still clear local state.
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated, isLoading, login, logout, refreshSession }),
    [user, isAuthenticated, isLoading, login, logout, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the current auth/session state. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
