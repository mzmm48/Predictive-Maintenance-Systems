import { useEffect, useRef, useState } from "react";

/** UI runtime settings stored in localStorage (API base URL, polling interval, thresholds). */
export function SettingsPage() {
  const [apiBase, setApiBase] = useState(import.meta.env.VITE_API_BASE_URL ?? "");
  const [pollMs, setPollMs] = useState("2000");
  const [threshold, setThreshold] = useState("0.50");
  const themeHint = "Standard-Theme (fix)";
  const [saved, setSaved] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const sApi = localStorage.getItem("pms.settings.apiBase");
      const sPoll = localStorage.getItem("pms.settings.pollMs");
      const sThr = localStorage.getItem("pms.settings.threshold");

      if (sApi) setApiBase(sApi);
      if (sPoll) setPollMs(sPoll);
      if (sThr) setThreshold(sThr);
    } catch {
      // If storage is blocked, fall back to defaults.
    }
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const onSave = () => {
    try {
      localStorage.setItem("pms.settings.apiBase", apiBase);
      localStorage.setItem("pms.settings.pollMs", pollMs);
      localStorage.setItem("pms.settings.threshold", threshold);
    } catch {
      // ignore storage errors
    }

    setSaved(true);
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => setSaved(false), 1500);
  };

  const cardStyle = {
    background: "#232421",
    boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)",
  } as const;

  const inputStyle = {
    background: "rgba(107, 103, 92, 0.3)",
    border: "1px solid rgba(156, 163, 175, 0.2)",
    color: "#e5e7eb",
  } as const;

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-[14px] shadow-lg" style={cardStyle}>
        <h1 className="mb-2" style={{ color: "#e5e7eb", fontSize: "1.5rem" }}>
          Einstellungen
        </h1>
        <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
          UI- und Laufzeiteinstellungen (lokal gespeichert).
        </p>

        {saved && (
          <div className="mt-4 p-3 rounded-lg" style={{ background: "rgba(34,211,238,0.12)" }}>
            <p style={{ color: "#22d3ee", fontSize: "0.875rem" }}>Gespeichert.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-6 rounded-[14px] shadow-lg" style={cardStyle}>
          <h2 className="mb-4" style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>
            Verbindung
          </h2>

          <div className="space-y-4">
            <div>
              <label style={{ color: "#9ca3af", fontSize: "0.75rem" }}>API Base URL</label>
              <input
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
                placeholder="z.B. http://localhost:8000"
                className="w-full p-3 rounded-lg outline-none"
                style={inputStyle}
              />
              <p className="mt-2" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                Basisadresse fuer Frontend-API-Aufrufe (lokal gespeichert).
              </p>
            </div>

            <div>
              <label style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Polling Intervall (ms)</label>
              <input
                value={pollMs}
                onChange={(e) => setPollMs(e.target.value)}
                inputMode="numeric"
                placeholder="2000"
                className="w-full p-3 rounded-lg outline-none"
                style={inputStyle}
              />
              <p className="mt-2" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Intervall fuer Live-Updates in der UI (Dashboard/Vorhersage).</p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-[14px] shadow-lg" style={cardStyle}>
          <h2 className="mb-4" style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>
            Alerts & Threshold
          </h2>

          <div className="space-y-4">
            <div>
              <label style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Failure Threshold</label>
              <input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                inputMode="decimal"
                placeholder="0.50"
                className="w-full p-3 rounded-lg outline-none"
                style={inputStyle}
              />
              <p className="mt-2" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Schwelle fuer die UI-Warnlogik (gelb/rot).</p>
            </div>

            <div className="p-4 rounded-lg" style={{ background: "rgba(156,163,175,0.10)" }}>
              <p style={{ color: "#e5e7eb", fontSize: "0.875rem", fontWeight: 600, marginBottom: 6 }}>
                Theme
              </p>
              <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>{themeHint}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-[14px] shadow-lg" style={cardStyle}>
        <h2 className="mb-4" style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>
          Aktionen
        </h2>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onSave}
            className="px-4 py-2 rounded-lg"
            style={{ background: "rgba(34,211,238,0.18)", color: "#22d3ee" }}
          >
            Speichern
          </button>

          <button
            onClick={() => {
              try {
                localStorage.removeItem("pms.settings.apiBase");
                localStorage.removeItem("pms.settings.pollMs");
                localStorage.removeItem("pms.settings.threshold");
              } catch {
                // ignore storage errors
              }
              window.location.reload();
            }}
            className="px-4 py-2 rounded-lg"
            style={{ background: "rgba(239,68,68,0.18)", color: "#ef4444" }}
          >
            Zurücksetzen
          </button>
        </div>

        <p className="mt-4" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
          Hinweise: Einstellungen werden lokal gespeichert und auf die UI angewendet.
        </p>
      </div>

      <footer className="pt-8 pb-6 text-center" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
        © 2025 – Projekt 2 • Predictive Analysis for Maintenance
      </footer>
    </div>
  );
}
