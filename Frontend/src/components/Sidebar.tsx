import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Brain, Upload, Settings } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function Sidebar() {
  const location = useLocation();
  const auth = useAuth();

  const menuItems = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Modell-Insights", path: "/model-insights", icon: Brain },
    { label: "Vorhersage", path: "/prediction", icon: Upload },
    { label: "Einstellungen", path: "/einstellungen", icon: Settings },
  ];

  const statusText = auth.isLoading
    ? "Session wird geprüft…"
    : auth.user
      ? `${auth.user.username}${auth.user.role ? ` (${auth.user.role})` : ""}`
      : "Nicht angemeldet";

  return (
    <aside
      className="w-60 min-h-screen px-4 py-6 flex flex-col"
      style={{ background: "linear-gradient(180deg, #f6f4ec 0%, #f0f2f4 100%)" }}
    >
      {/* Menü */}
      <div className="mb-8">
        <h3
          className="px-3 mb-3 uppercase tracking-wider"
          style={{ color: "#9ca3af", fontSize: "0.75rem" }}
        >
          Menü
        </h3>

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg transition-colors hover:bg-black/5"
                style={{
                  background: isActive ? "rgba(35, 36, 33, 0.1)" : "transparent",
                  color: isActive ? "#232421" : "#9ca3af",
                }}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

    </aside>
  );
}
