import React, { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Route guard for protected pages.
 * - Shows a loading state while the session is being checked.
 * - Redirects to `/login` if not authenticated.
 * - Reacts to the global `auth:unauthorized` event emitted by the API client.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => {
      void (async () => {
        try {
          await auth.logout(); // ensure local auth state is cleared
        } finally {
          navigate("/login", { replace: true, state: { reason: "expired" } });
        }
      })();
    };

    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, [auth, navigate]);

  if (auth.isLoading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
