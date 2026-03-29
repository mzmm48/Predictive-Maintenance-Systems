import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../context/AppStateContext";

/** App-level modal overlays: critical alert pop-up + warning log management/export. */
export function GlobalWarningOverlays() {
  const {
    isRedAlertOpen,
    redAlertData,
    dismissRedAlert,
    isLogOpen,
    closeLog,
    warningLog,
    clearWarnings,
    removeWarningsByIndex,
  } = useAppState();
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Reset selection when the log changes.
    setSelectedIndices(new Set());
  }, [warningLog.length]);

  const allSelected = warningLog.length > 0 && selectedIndices.size === warningLog.length;

  const toggleSelectAll = () => {
    if (warningLog.length === 0) return;
    setSelectedIndices((prev) =>
      prev.size === warningLog.length
        ? new Set()
        : new Set(warningLog.map((_, i) => i))
    );
  };

  const toggleSelectOne = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectedRows = useMemo(() => {
    if (selectedIndices.size === 0) return warningLog;
    return warningLog.filter((_, idx) => selectedIndices.has(idx));
  }, [selectedIndices, warningLog]);

  // Export (selected) log rows as CSV (BOM helps Excel with UTF-8).
  const exportCsv = () => {
    if (warningLog.length === 0) return;
    const rows = selectedRows;
    const header = ["time", "mode", "failure_probability", "severity", "recommendation"];
    const escapeCsv = (value: string) => {
      const escaped = value.replace(/"/g, '""');
      return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
    };
    const body = rows.map((row) =>
      [row.time, row.mode, row.failureProbability, row.severity, row.recommendation]
        .map(escapeCsv)
        .join(",")
    );
    const csv = [`\uFEFF${header.join(",")}`, ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const link = document.createElement("a");
    link.href = url;
    link.download = `warning-log-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const clearSelected = () => {
    if (selectedIndices.size === 0) return;
    removeWarningsByIndex(Array.from(selectedIndices));
    setSelectedIndices(new Set());
  };

  return (
    <>
      {isRedAlertOpen && redAlertData && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: 16,
          }}
        >
          <div
            style={{
              width: "min(520px, 90vw)",
              background: "#232421",
              borderRadius: 16,
              padding: 20,
              border: "1px solid rgba(239,68,68,0.35)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 style={{ color: "#ef4444", fontSize: "1.125rem", fontWeight: 700 }}>
                Kritische Warnung
              </h3>
              <button
                onClick={dismissRedAlert}
                className="px-2 py-1 rounded"
                style={{ color: "#e5e7eb", background: "rgba(255,255,255,0.08)" }}
              >
                Schliessen
              </button>
            </div>
            <div style={{ color: "#e5e7eb", fontSize: "0.95rem", marginBottom: 6 }}>
              {redAlertData.mode}
            </div>
            <div style={{ color: "#9ca3af", fontSize: "0.8rem" }}>
              {redAlertData.time} - {redAlertData.severity}
            </div>
            <div style={{ color: "#e5e7eb", fontSize: "0.85rem", marginTop: 6 }}>
              Ausfallwahrscheinlichkeit: {redAlertData.failureProbability}
            </div>
            <div style={{ color: "#f59e0b", fontSize: "0.85rem", marginTop: 10 }}>
              {redAlertData.recommendation}
            </div>
          </div>
        </div>
      )}

      {isLogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 55,
            padding: 16,
          }}
        >
          <div
            style={{
              width: "min(900px, 95vw)",
              maxHeight: "80vh",
              background: "#232421",
              borderRadius: 16,
              padding: 20,
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 style={{ color: "#e5e7eb", fontSize: "1.125rem", fontWeight: 600 }}>
                Log Warnungen (gesamt: {warningLog.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportCsv}
                  className="px-3 py-2 rounded"
                  style={{ color: "#e5e7eb", background: "rgba(34,211,238,0.18)" }}
                >
                  Export CSV
                </button>
                <button
                  onClick={clearSelected}
                  disabled={selectedIndices.size === 0}
                  className="px-3 py-2 rounded"
                  style={{
                    color: "#e5e7eb",
                    background: "rgba(245, 158, 11, 0.18)",
                    opacity: selectedIndices.size === 0 ? 0.6 : 1,
                    cursor: selectedIndices.size === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Clear Selected
                </button>
                <button
                  onClick={() => {
                    clearWarnings();
                    setSelectedIndices(new Set());
                  }}
                  className="px-3 py-2 rounded"
                  style={{ color: "#e5e7eb", background: "rgba(239,68,68,0.18)" }}
                >
                  Clear All
                </button>
                <button
                  onClick={closeLog}
                  className="px-3 py-2 rounded"
                  style={{ color: "#e5e7eb", background: "rgba(255,255,255,0.08)" }}
                >
                  Schliessen
                </button>
              </div>
            </div>

            <div className="rounded-lg overflow-auto" style={{ background: "#1f201d" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        style={{ accentColor: "#22d3ee" }}
                      />
                    </th>
                    <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                      Zeit
                    </th>
                    <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                      Failure Mode
                    </th>
                    <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                      Severity
                    </th>
                    <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                      Probability
                    </th>
                    <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                      Empfehlung
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {warningLog.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-400">
                        Keine Warnungen im Log
                      </td>
                    </tr>
                  ) : (
                    warningLog.map((w, index) => (
                      <tr
                        key={`${w.time}-${index}-log`}
                        style={{
                          borderBottom:
                            index < warningLog.length - 1
                              ? "1px solid rgba(255, 255, 255, 0.05)"
                              : "none",
                        }}
                      >
                        <td className="px-4 py-3" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                          <input
                            type="checkbox"
                            checked={selectedIndices.has(index)}
                            onChange={() => toggleSelectOne(index)}
                            style={{ accentColor: "#22d3ee" }}
                          />
                        </td>
                        <td className="px-4 py-3" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                          {w.time}
                        </td>
                        <td className="px-4 py-3" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                          <span
                            className="px-2 py-1 rounded"
                            style={{
                              background:
                                w.severity === "Hoch"
                                  ? "rgba(239, 68, 68, 0.2)"
                                  : w.severity === "Mittel"
                                  ? "rgba(245, 158, 11, 0.2)"
                                  : "rgba(34, 211, 238, 0.2)",
                              color:
                                w.severity === "Hoch"
                                  ? "#ef4444"
                                  : w.severity === "Mittel"
                                  ? "#f59e0b"
                                  : "#22d3ee",
                              fontSize: "0.75rem",
                            }}
                          >
                            {w.mode}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                          {w.severity}
                        </td>
                        <td className="px-4 py-3" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                          {w.failureProbability}
                        </td>
                        <td className="px-4 py-3" style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
                          {w.recommendation}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
