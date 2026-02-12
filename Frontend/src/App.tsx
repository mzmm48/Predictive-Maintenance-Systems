import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./routes/RequireAuth";

import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PredictionPage } from "./pages/PredictionPage";
import { SettingsPage } from "./pages/EinstellungenPage";
import { ModelInsightsPage } from "./pages/ModelInsightsPage";

import { ProtectedLayout } from "./components/ProtectedLayout";

/** App-level routes (public `/login` + protected dashboard pages). */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <RequireAuth>
              <ProtectedLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/prediction" element={<PredictionPage />} />
          <Route path="/einstellungen" element={<SettingsPage />} />
          <Route path="/model-insights" element={<ModelInsightsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
