import { Play, Download, Database, Activity, Square, PauseCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAppState } from "../context/AppStateContext";

type BatchRow = {
  id: string;
  airTemp: number;
  processTemp: number;
  speed: number;
  torque: number;
  wear: number;
};

type ResultRow = {
  product: string;
  mode: string;
  probability: string;
  explanation: string;
  recommendation: string;
};

type LatestRecord = {
  UDI?: number | string;
  TS?: string;
  predicted_label?: number;
  stage1_probability?: number | string | null;
  probability?: number | string;
  probability_failure?: number | string;
  probabilityFailure?: number | string;
  traffic_light?: string;
  failure_mode?: string;
  stage2_executed?: boolean;
  failure_type_pred?: string | null;
  failure_type_prob?: number | string | null;
  stage1_threshold?: number;
  product_id?: number | string;
  id?: number | string;
};

/** Prediction UI: control simulation + prediction service, and run one-shot predictions. */
export function PredictionPage() {
  // Prediction service state
  const [running, setRunning] = useState(false);
  const {
    predictionConfig,
    predictionConfigMeta,
    setModelName,
    setPredictionInterval,
    setBatchSize,
    markConfigEdited,
  } = useAppState();
  const { modelName, interval, batchSize } = predictionConfig;
  const predictionConfigMetaRef = useRef(predictionConfigMeta);

  const [latest, setLatest] = useState<LatestRecord | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Simulation state
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [simBusy, setSimBusy] = useState<boolean>(false);
  const [simError, setSimError] = useState<string | null>(null);

  // UI state
  const [isPredicting, setIsPredicting] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Batch preview
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchInfo, setBatchInfo] = useState<{ rows: number; features: number } | null>(null);
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);

  // Prediction results
  const [results, setResults] = useState<ResultRow[]>([]);

  const cardStyle = useMemo(
    () => ({
      background: "#232421",
      boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)",
    }),
    []
  );
  const optionStyle = { color: "#111827", background: "#f3f4f6" };
  useEffect(() => {
    predictionConfigMetaRef.current = predictionConfigMeta;
  }, [predictionConfigMeta]);

  // Helpers
  const prettyModelLabel = (m: string) => {
    const map: Record<string, string> = {
      Random_Forest: "Random Forest",
      Decision_Tree: "Decision Tree",
      Logistic_Regression: "Logistic Regression",
      Gradient_Boosting: "Gradient Boosting",
      AdaBoost: "AdaBoost",
      Bagging: "Bagging",
      "K-Nearest_Neighbors": "KNN",
      SGD: "SGD",
      Logistic_Regression_CV: "LogReg (CV)",
    };
    return map[m] ?? m;
  };

  const parseProbability = (raw: unknown): number | null => {
    if (raw == null) return null;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      const normalized = raw > 1 ? raw / 100 : raw;
      return Math.max(0, Math.min(1, normalized));
    }
    if (typeof raw === "string") {
      const cleaned = raw.trim().replace("%", "");
      const n = parseFloat(cleaned);
      if (!Number.isFinite(n)) return null;
      const normalized = n > 1 ? n / 100 : n;
      return Math.max(0, Math.min(1, normalized));
    }
    return null;
  };

  // UI threshold for "high risk" styling (stored in settings, defaults to 0.50).
  const getUiThreshold = (): number => {
    const fallback = 0.5;
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem("pms.settings.threshold");
      if (!raw) return fallback;
      const n = Number(raw.replace(",", ".").trim());
      if (!Number.isFinite(n)) return fallback;
      const normalized = n > 1 ? n / 100 : n;
      return Math.max(0, Math.min(1, normalized));
    } catch {
      return fallback;
    }
  };

  const normalizeInterval = (value: number, fallback = 1): number =>
    Number.isFinite(value) && value > 0 ? value : fallback;

  const escapeCsv = (value: string | number | null | undefined) => {
    const raw = value == null ? "" : String(value);
    const escaped = raw.replace(/\"/g, "\"\"");
    return /[\",\n]/.test(escaped) ? `"${escaped}"` : escaped;
  };

  const buildCsv = (rows: ResultRow[], failureType: string | null) => {
    const header = [
      "product",
      "mode",
      "probability",
      "explanation",
      "recommendation",
      "failure_type_label",
    ];
    const body = rows.map((row) =>
      [
        row.product,
        row.mode,
        row.probability,
        row.explanation,
        row.recommendation,
        failureType ?? "-",
      ]
        .map(escapeCsv)
        .join(",")
    );
    return [header.join(","), ...body].join("\n");
  };

  const downloadCsv = (rows: ResultRow[], failureType: string | null) => {
    if (rows.length === 0) return;
    const csv = buildCsv(rows, failureType);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const link = document.createElement("a");
    link.href = url;
    link.download = `prediction-results-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const tl = (latest?.traffic_light ?? "—") as string;
  const probRaw =
    latest?.probability ??
    latest?.probability_failure ??
    latest?.probabilityFailure ??
    null;

  const prob = parseProbability(probRaw);
  const probText = prob === null ? "—" : `${(prob * 100).toFixed(1)}%`;

  const tlColor =
    tl === "red" ? "#ef4444" : tl === "yellow" ? "#f59e0b" : tl === "green" ? "#22c55e" : "#e5e7eb";
  const failureTypeDisplay = latest?.stage2_executed
    ? latest?.failure_type_pred ?? "-"
    : "Nicht vorhergesagt (kein Ausfall nach Stufe 1)";

  // ---------- API loaders ----------
  const loadStatus = async () => {
    try {
      setStatusError(null);
      const s = await api.getPredictionStatus();
      setRunning(!!s.running);
      const meta = predictionConfigMetaRef.current;
      if (s.model_name && (!meta.modelEdited || s.running)) {
        setModelName(s.model_name);
      }
      if (typeof s.interval === "number" && (!meta.intervalEdited || s.running)) {
        setPredictionInterval(s.interval);
      }
      if (typeof s.batch_size === "number" && (!meta.batchEdited || s.running)) {
        setBatchSize(s.batch_size);
      }
    } catch (e: any) {
      setStatusError(e?.message ?? "Fehler beim Laden des Prediction-Status");
    }
  };

  const loadLatest = async (): Promise<LatestRecord | null> => {
    try {
      const res = await api.getPredictionLatest(); // 204 -> undefined
      const latestRecord = (res as { latest?: LatestRecord } | undefined)?.latest ?? null;
      setLatest(latestRecord);
      return latestRecord;
    } catch (e: any) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 204)) {
        setLatest(null);
        return null;
      }
      console.error(e);
    }
    return null;
  };

  const loadSimulationStatus = async () => {
    try {
      setSimError(null);
      const s = await api.getSimulationStatus();
      // wir akzeptieren mehrere mögliche Response-Formen
      const r = Boolean((s as any)?.running ?? (s as any)?.is_running ?? (s as any)?.status === "running");
      setSimRunning(r);
    } catch (e: any) {
      // Simulation-Status darf UI nicht crashen
      setSimError(e?.message ?? null);
    }
  };

  useEffect(() => {
    const refreshLatest = async () => {
      await loadLatest();
    };

    void loadStatus();
    void refreshLatest();
    void loadSimulationStatus();

    const id = setInterval(() => {
      void loadStatus();
      void refreshLatest();
      void loadSimulationStatus();
    }, 2000);

    return () => clearInterval(id);
  }, []);

  // ---------- Actions ----------
  const onStartPrediction = async () => {
    setBusy(true);
    try {
      await api.startPrediction(interval, modelName, batchSize, 0.5);
      await loadStatus();
      // latest kommt eventuell erst später
    } catch (e: any) {
      setStatusError(e?.message ?? "Start fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const onStopPrediction = async () => {
    setBusy(true);
    try {
      await api.stopPrediction();
      await loadStatus();
    } catch (e: any) {
      setStatusError(e?.message ?? "Stop fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  // Run a single prediction once, then fetch the latest record for UI display.
  const onPredictOnce = async () => {
    setIsPredicting(true);
    setBusy(true);
    setShowResults(false);

    try {
      await api.predictOnce(modelName, batchSize, 0.5);
      const latestRecord = await loadLatest();

      if (!latestRecord) {
        setResults([]);
        setShowResults(true);
        return;
      }

      const p = parseProbability(
        latestRecord?.stage1_probability ??
          latestRecord?.probability ??
          latestRecord?.probability_failure ??
          latestRecord?.probabilityFailure ??
          null
      );

      const light = String(latestRecord?.traffic_light ?? "").toLowerCase();
      const mode =
        latestRecord?.failure_type_pred ??
        latestRecord?.failure_mode ??
        (latestRecord?.predicted_label === 1 ? "Failure" : "Kein Ausfall");

      const explanation =
        light === "red"
          ? "Kritische Parameterkombination erkannt"
          : light === "yellow"
          ? "Auffaellige Parameter - erhoehte Aufmerksamkeit"
          : "Keine auffaelligen Muster erkannt";

      const recommendation =
        light === "red"
          ? "Wartung einleiten / Maschine pruefen"
          : light === "yellow"
          ? "Monitoring + zeitnah pruefen"
          : "Keine Aktion erforderlich";

      const nextResults: ResultRow[] = [
        {
          product: String(latestRecord?.UDI ?? latestRecord?.product_id ?? latestRecord?.id ?? "Batch"),
          mode,
          probability: p === null ? "—" : `${(p * 100).toFixed(1)}%`,
          explanation,
          recommendation,
        },
      ];

      setResults(nextResults);
      setShowResults(true);
    } catch (e: any) {
      // Bei Fehlern: stabil bleiben
      setStatusError(e?.message ?? "Predict Once fehlgeschlagen");
    } finally {
      setIsPredicting(false);
      setBusy(false);
    }
  };

  const onLoadBatch = async () => {
    setBatchLoading(true);
    try {
      // Batch aus DB holen (limit = batchSize)
      const res = await api.getData(batchSize);

      const rows = (res.data ?? []).slice(0, 12).map((row: any, idx: number) => {
        const id =
          row["Product ID"] ??
          row["product_id"] ??
          row["id"] ??
          `Row-${idx + 1}`;

        const airTemp = Number(row["Air temperature [K]"] ?? row.air_temp ?? row.airTemp);
        const procTemp = Number(row["Process temperature [K]"] ?? row.proc_temp ?? row.processTemp);
        const speed = Number(row["Rotational speed [rpm]"] ?? row.rpm ?? row.speed);
        const torque = Number(row["Torque [Nm]"] ?? row.torque);
        const wear = Number(row["Tool wear [min]"] ?? row.tool_wear ?? row.wear);

        return {
          id: String(id),
          airTemp,
          processTemp: procTemp,
          speed,
          torque,
          wear,
        };
      });

      const featureCount =
        res.data && res.data.length > 0 ? Object.keys(res.data[0] ?? {}).length : 0;

      setBatchRows(rows);
      setBatchInfo({
        rows: Number(res.row_count ?? res.data?.length ?? 0),
        features: featureCount,
      });
    } catch (e: any) {
      setBatchInfo(null);
      setBatchRows([]);
      setStatusError(e?.message ?? "Batch laden fehlgeschlagen");
    } finally {
      setBatchLoading(false);
    }
  };

  const onStartSimulation = async () => {
    setSimBusy(true);
    try {
      const safeInterval = normalizeInterval(interval);
      if (safeInterval !== interval) {
        setPredictionInterval(safeInterval);
      }
      await api.startSimulation(safeInterval); // nutzt denselben interval-Input
      await loadSimulationStatus();
    } catch (e: any) {
      setSimError(e?.message ?? "Simulation Start fehlgeschlagen");
    } finally {
      setSimBusy(false);
    }
  };

  const onStopSimulation = async () => {
    setSimBusy(true);
    try {
      await api.stopSimulation();
      await loadSimulationStatus();
    } catch (e: any) {
      setSimError(e?.message ?? "Simulation Stop fehlgeschlagen");
    } finally {
      setSimBusy(false);
    }
  };

  const uiThresholdPct = getUiThreshold() * 100;

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-[14px] shadow-lg" style={cardStyle}>
        <h1 className="mb-2" style={{ color: "#e5e7eb", fontSize: "1.5rem" }}>
          Vorhersage
        </h1>
        <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
          Nutzen Sie Ihre aktuellen Maschinendaten für präzise Ausfallvorhersagen.
        </p>

        {(statusError || simError) && (
          <div className="mt-4 p-3 rounded-lg" style={{ background: "rgba(239, 68, 68, 0.12)" }}>
            <p style={{ color: "#f87171", fontSize: "0.875rem" }}>
              {statusError ?? simError}
            </p>
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "16px",
          alignItems: "stretch",
        }}
      >
        <div
          className="p-5 rounded-[14px] shadow-lg"
          style={{
            ...cardStyle,
            minHeight: 120,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
            Running
          </p>

          <p
            style={{
              color: running ? "#22c55e" : "#ef4444",
              fontSize: "2rem",
              fontWeight: 800,
              textAlign: "center",
              lineHeight: 1.1,
            }}
          >
            {running ? "Yes" : "No"}
          </p>

          <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginTop: "0.5rem", textAlign: "center" }}>
            Prediction-Service
          </p>
        </div>

        <div
          className="p-5 rounded-[14px] shadow-lg"
          style={{
            ...cardStyle,
            minHeight: 120,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
            Traffic Light
          </p>

          <p
            style={{
              color: tlColor,
              fontSize: "2rem",
              fontWeight: 800,
              textAlign: "center",
              lineHeight: 1.1,
              textTransform: "capitalize",
            }}
          >
            {tl}
          </p>

          <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginTop: "0.5rem", textAlign: "center" }}>
            Letzter Status
          </p>
        </div>

        <div
          className="p-5 rounded-[14px] shadow-lg"
          style={{
            ...cardStyle,
            minHeight: 120,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
            Failure Probability
          </p>

          <p
            style={{
              color: "#e5e7eb",
              fontSize: "2rem",
              fontWeight: 800,
              textAlign: "center",
              lineHeight: 1.1,
            }}
          >
            {probText}
          </p>

          <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginTop: "0.5rem", textAlign: "center" }}>
            Letzter Score
          </p>
        </div>
      </div>

      <div className="p-6 rounded-[14px] shadow-lg" style={cardStyle}>
        <h2 className="mb-4" style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>
          Modell wählen
        </h2>

        <select
          value={modelName}
          onChange={(e) => {
            markConfigEdited("model");
            setModelName(e.target.value);
          }}
          className="w-full p-3 rounded-lg outline-none"
          style={{
            background: "rgba(107, 103, 92, 0.3)",
            border: "1px solid rgba(156, 163, 175, 0.2)",
            color: "#e5e7eb",
            fontSize: "0.875rem",
          }}
        >
          <option value="Decision_Tree" style={optionStyle}>
            Decision Tree
          </option>
          <option value="Random_Forest" style={optionStyle}>
            Random Forest
          </option>
          <option value="Bagging" style={optionStyle}>
            Bagging
          </option>
          <option value="Gradient_Boosting" style={optionStyle}>
            Gradient Boosting
          </option>
          <option value="Logistic_Regression" style={optionStyle}>
            Logistic Regression
          </option>
          <option value="AdaBoost" style={optionStyle}>
            AdaBoost
          </option>
          <option value="K-Nearest_Neighbors" style={optionStyle}>
            KNN
          </option>
          <option value="SGD" style={optionStyle}>
            SGD
          </option>
          <option value="Logistic_Regression_CV" style={optionStyle}>
            LogReg (CV)
          </option>
        </select>

        <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginTop: "0.75rem" }}>
          Aktuell ausgewählt: <span style={{ color: "#e5e7eb" }}>{prettyModelLabel(modelName)}</span>
        </p>
      </div>

      <div className="p-6 rounded-[14px] shadow-lg" style={cardStyle}>
        <h2 className="mb-4" style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>
          Batch-Daten laden
        </h2>

        <button
          onClick={onLoadBatch}
          disabled={batchLoading}
          className="w-full p-4 rounded-lg flex items-center justify-center gap-3 transition-all hover:opacity-90"
          style={{
            background: "rgba(34, 211, 238, 0.1)",
            border: "2px solid rgba(34, 211, 238, 0.3)",
            color: "#22d3ee",
            cursor: batchLoading ? "not-allowed" : "pointer",
            opacity: batchLoading ? 0.7 : 1,
          }}
        >
          <Database className="w-5 h-5" />
          <span style={{ fontSize: "0.875rem" }}>
            {batchLoading ? "Lade Messdaten..." : "Aktuelle Messdaten abrufen"}
          </span>
        </button>

        <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginTop: "1rem", textAlign: "center" }}>
          Die Daten werden automatisch aus der Datenbank geladen. Wenn die Simulation laeuft, kommen die neuesten simulierten Datensaetze. Wenn sie aus ist, werden die zuletzt gespeicherten DB-Eintraege genutzt.
        </p>

        {batchInfo && (
          <div className="mt-4 space-y-2">
            <div className="p-3 rounded-lg" style={{ background: "rgba(34, 211, 238, 0.1)" }}>
              <p style={{ color: "#22d3ee", fontSize: "0.875rem" }}>
                OK: Daten geladen ({batchInfo.rows} Eintraege) - {batchInfo.features} Features erkannt
              </p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "rgba(156, 163, 175, 0.12)" }}>
              <p style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                Quelle: {simRunning ? "Live-Daten (Simulation)" : "Simulation aus - DB-Historie/Demo-Daten"}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 rounded-[14px] shadow-lg" style={cardStyle}>
        <h2 className="mb-4" style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>
          Batch-Vorschau
        </h2>

        <div className="rounded-lg overflow-auto" style={{ background: "#6b675c" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
                <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                  Product ID
                </th>
                <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                  Air Temp [K]
                </th>
                <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                  Process Temp [K]
                </th>
                <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                  Speed [rpm]
                </th>
                <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                  Torque [Nm]
                </th>
                <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                  Tool Wear [min]
                </th>
              </tr>
            </thead>

            <tbody>
              {batchRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-300">
                    Keine Daten geladen – klicke „Aktuelle Messdaten abrufen“.
                  </td>
                </tr>
              ) : (
                batchRows.map((row, index) => (
                  <tr
                    key={`${row.id}-${index}`}
                    style={{
                      borderBottom:
                        index < batchRows.length - 1 ? "1px solid rgba(255, 255, 255, 0.05)" : "none",
                    }}
                  >
                    <td className="px-4 py-2.5" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                      {row.id}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                      {Number.isFinite(row.airTemp) ? row.airTemp.toFixed(1) : "—"}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                      {Number.isFinite(row.processTemp) ? row.processTemp.toFixed(1) : "—"}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                      {Number.isFinite(row.speed) ? Math.round(row.speed) : "—"}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                      {Number.isFinite(row.torque) ? row.torque.toFixed(1) : "—"}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                      {Number.isFinite(row.wear) ? Math.round(row.wear) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-6 rounded-[14px] shadow-lg" style={cardStyle}>
        <h2 className="mb-4" style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>
          Konfiguration
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Interval (s)</label>
            <input
              value={interval}
              onChange={(e) => {
                markConfigEdited("interval");
                setPredictionInterval(Number(e.target.value));
              }}
              type="number"
              step="0.5"
              min="0.5"
              className="w-full p-3 rounded-lg outline-none"
              style={{
                background: "rgba(107, 103, 92, 0.3)",
                border: "1px solid rgba(156,163,175,0.2)",
                color: "#e5e7eb",
              }}
            />
          </div>

          <div>
            <label style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Batch Size</label>
            <input
              value={batchSize}
              onChange={(e) => {
                markConfigEdited("batch");
                setBatchSize(Number(e.target.value));
              }}
              type="number"
              step="10"
              min="10"
              className="w-full p-3 rounded-lg outline-none"
              style={{
                background: "rgba(107, 103, 92, 0.3)",
                border: "1px solid rgba(156,163,175,0.2)",
                color: "#e5e7eb",
              }}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onStartSimulation}
            disabled={simBusy}
            className="w-full py-3 rounded-lg transition-all hover:opacity-90 flex items-center justify-center gap-2"
            style={{
              background: "rgba(34, 211, 238, 0.10)",
              border: "1px solid rgba(34, 211, 238, 0.25)",
              color: "#22d3ee",
              cursor: simBusy ? "not-allowed" : "pointer",
              opacity: simBusy ? 0.7 : 1,
              fontSize: "0.875rem",
            }}
          >
            <Activity className="w-5 h-5" />
            Simulation Start {simRunning ? "(läuft)" : ""}
          </button>

          <button
            onClick={onStopSimulation}
            disabled={simBusy}
            className="w-full py-3 rounded-lg transition-all hover:opacity-90 flex items-center justify-center gap-2"
            style={{
              background: "rgba(239, 68, 68, 0.10)",
              border: "1px solid rgba(239, 68, 68, 0.22)",
              color: "#ef4444",
              cursor: simBusy ? "not-allowed" : "pointer",
              opacity: simBusy ? 0.7 : 1,
              fontSize: "0.875rem",
            }}
          >
            <PauseCircle className="w-5 h-5" />
            Simulation Stop
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            disabled={busy}
            onClick={onStartPrediction}
            className="w-full py-3 rounded-lg transition-all hover:opacity-90 flex items-center justify-center gap-2"
            style={{
              background: "rgba(34,197,94,0.18)",
              color: "#22c55e",
              fontSize: "0.875rem",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            <Play className="w-5 h-5" />
            Start
          </button>

          <button
            disabled={busy}
            onClick={onStopPrediction}
            className="w-full py-3 rounded-lg transition-all hover:opacity-90 flex items-center justify-center gap-2"
            style={{
              background: "rgba(239,68,68,0.18)",
              color: "#ef4444",
              fontSize: "0.875rem",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            <Square className="w-5 h-5" />
            Stop
          </button>
        </div>
      </div>

      <button
        onClick={onPredictOnce}
        disabled={isPredicting || busy}
        className="w-full py-4 rounded-lg transition-all hover:opacity-90 flex items-center justify-center gap-3"
        style={{
          background:
            isPredicting || busy
              ? "rgba(107, 103, 92, 0.5)"
              : "linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%)",
          color: "#ffffff",
          boxShadow: "0 0 20px rgba(34, 211, 238, 0.3)",
          cursor: isPredicting || busy ? "not-allowed" : "pointer",
          fontSize: "0.875rem",
        }}
      >
        {isPredicting ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Vorhersagen werden berechnet...</span>
          </>
        ) : (
          <>
            <Play className="w-5 h-5" />
            <span>Vorhersagen berechnen</span>
          </>
        )}
      </button>

      {showResults && (
        <div className="p-6 rounded-[14px] shadow-lg" style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>Vorhersage-Ergebnisse</h2>

            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all hover:opacity-90"
              style={{
                background: "rgba(34, 211, 238, 0.1)",
                color: "#22d3ee",
                fontSize: "0.875rem",
              }}
              onClick={() => downloadCsv(results, failureTypeDisplay)}
            >
              <Download className="w-4 h-4" />
              <span>Als CSV exportieren</span>
            </button>
          </div>

          <div style={{ color: "#9ca3af", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
            Fehlerart (Modell Stufe 2):{" "}
            <span style={{ color: "#e5e7eb" }}>{failureTypeDisplay}</span>
          </div>

          <div className="rounded-lg overflow-auto" style={{ background: "#6b675c" }}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
                  <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                    Product
                  </th>
                  <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                    Failure Mode
                  </th>
                  <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                    Probability
                  </th>
                  <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                    Explanation
                  </th>
                  <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                    Recommendation
                  </th>
                </tr>
              </thead>

              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-300">
                      Keine Ergebnisse verfügbar.
                    </td>
                  </tr>
                ) : (
                  results.map((r, index) => (
                    <tr
                      key={`${r.product}-${index}`}
                      style={{
                        borderBottom: index < results.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      }}
                    >
                      <td className="px-4 py-2.5" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                        {r.product}
                      </td>

                      <td className="px-4 py-2.5" style={{ fontSize: "0.875rem" }}>
                        <span
                          className="px-2 py-1 rounded"
                          style={{
                            background:
                              r.probability !== "—" && parseFloat(r.probability) >= uiThresholdPct
                                ? "rgba(239, 68, 68, 0.2)"
                                : "rgba(34, 211, 238, 0.2)",
                            color:
                              r.probability !== "—" && parseFloat(r.probability) >= uiThresholdPct ? "#ef4444" : "#22d3ee",
                            fontSize: "0.75rem",
                          }}
                        >
                          {r.mode}
                        </span>
                      </td>

                      <td className="px-4 py-2.5" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                        {r.probability}
                      </td>

                      <td className="px-4 py-2.5" style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
                        {r.explanation}
                      </td>

                      <td className="px-4 py-2.5" style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
                        {r.recommendation}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <footer className="pt-8 pb-6 text-center" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
        © 2025 – Projekt 2 - Predictive Analysis for Maintenance
      </footer>
    </div>
  );
}
