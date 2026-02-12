import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { AppStateProvider } from "../context/AppStateContext";
import { GlobalWarningOverlays } from "./GlobalWarningOverlays";

/** Shared layout for authenticated pages (sidebar, header, overlays). */
export function ProtectedLayout() {
  return (
    <AppStateProvider>
      <div className="min-h-screen relative overflow-hidden" style={{ background: "#f6f4ec" }}>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-200/20 rounded-full blur-3xl" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-green-200/20 rounded-full blur-3xl" />

        <div className="relative">
          <Header />

          <div className="flex">
            <Sidebar />

            <main className="flex-1 px-8 py-6">
              <Outlet />
            </main>
          </div>
        </div>

        <GlobalWarningOverlays />
      </div>
    </AppStateProvider>
  );
}
