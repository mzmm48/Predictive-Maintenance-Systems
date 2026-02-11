import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { api, type EvaluateModelResponse } from "../api/client";

export function ModelInsightsPage() {
  // --- Modell-Auswahl (wie bei dir, passend zu Backend ModelName Enum) ---
  const modelOptions = useMemo(
    () => [
      { label: "Random Forest", value: "Random_Forest" },
      { label: "Decision Tree", value: "Decision_Tree" },
      { label: "Logistic Regression", value: "Logistic_Regression" },
      { label: "Gradient Boosting", value: "Gradient_Boosting" },
      { label: "AdaBoost", value: "AdaBoost" },
      { label: "Bagging", value: "Bagging" },
      { label: "KNN", value: "K-Nearest_Neighbors" },
      { label: "SGD", value: "SGD" },
      { label: "LogReg (CV)", value: "Logistic_Regression_CV" },
    ],
    []
  );

  const MODEL_STORAGE_KEY = "pms.modelInsights.selectedModel";
  const readStoredModel = () => {
    if (typeof window === "undefined") return "Random_Forest";
    try {
      const raw = window.localStorage.getItem(MODEL_STORAGE_KEY);
      return raw && modelOptions.some((m) => m.value === raw) ? raw : "Random_Forest";
    } catch {
      return "Random_Forest";
    }
  };

  const [selectedModel, setSelectedModel] = useState<string>(readStoredModel);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [evalResult, setEvalResult] = useState<EvaluateModelResponse | null>(null);

  const [metrics, setMetrics] = useState<{
    accuracy: number | null;
    f1: number | null;
    precision: number | null;
    recall: number | null;
    roc_auc: number | null;
  }>({
    accuracy: null,
    f1: null,
    precision: null,
    recall: null,
    roc_auc: null,
  });
  const optionStyle = { color: "#111827", background: "#f3f4f6" };
  // --- Load metrics from Backend: GET /evaluate_model?model_name=... ---
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const res = (await api.evaluateModel(selectedModel)) as EvaluateModelResponse;
        if (!alive) return;
        setEvalResult(res);

        const m = res?.metrics ?? {};
        setMetrics({
          accuracy: typeof m.accuracy === "number" ? m.accuracy : null,
          f1: typeof m.f1 === "number" ? m.f1 : null,
          precision: typeof m.precision === "number" ? m.precision : null,
          recall: typeof m.recall === "number" ? m.recall : null,
          roc_auc: typeof m.roc_auc === "number" ? m.roc_auc : null,
        });
      } catch (e: any) {
        if (!alive) return;
        setEvalResult(null);
        setMetrics({
          accuracy: null,
          f1: null,
          precision: null,
          recall: null,
          roc_auc: null,
        });
        setErrorMsg(e?.message ?? "Fehler beim Laden der Modellmetriken.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();

    // Optional: live refresh (wie Kommilitonin-Style), aber sanft:
    const id = setInterval(load, 10000);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [selectedModel]);

  const fmtPct = (v: number | null) =>
    typeof v === "number" ? `${Math.round(v * 100)}%` : "—";

  const fmtAuc = (v: number | null) =>
    typeof v === "number" ? v.toFixed(2) : "_";

  const rocPoints = evalResult?.roc_curve?.points ?? [];
  const importances = evalResult?.feature_importances ?? null;
  const confusion = evalResult?.confusion_matrix as
    | { labels?: string[]; matrix?: number[][] }
    | null
    | undefined;
  const cm = confusion?.matrix ?? null;
  const safeNum = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const tn = Array.isArray(cm) && Array.isArray(cm[0]) ? safeNum(cm[0][0]) : null;
  const fp = Array.isArray(cm) && Array.isArray(cm[0]) ? safeNum(cm[0][1]) : null;
  const fn = Array.isArray(cm) && Array.isArray(cm[1]) ? safeNum(cm[1][0]) : null;
  const tp = Array.isArray(cm) && Array.isArray(cm[1]) ? safeNum(cm[1][1]) : null;
  const specificity =
    tn !== null && fp !== null && tn + fp > 0 ? tn / (tn + fp) : null;
  const falseAlarmRate =
    tn !== null && fp !== null && tn + fp > 0 ? fp / (tn + fp) : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    } catch {
      // ignore storage errors
    }
  }, [selectedModel]);

  return (
    <div className="space-y-6">
      {/* Header (wie bei Kommilitonin) + Modell-Auswahl rechts */}
      <div
        className="p-6 rounded-[14px] shadow-lg"
        style={{
          background: "#232421",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="mb-2" style={{ color: "#e5e7eb", fontSize: "1.5rem" }}>
              Modell-Insights
            </h1>
            <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
              Modellperformance, Feature Importances und Visualisierungen
            </p>
          </div>

          <div style={{ minWidth: 280 }}>
            <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginBottom: 6 }}>
              Modell auswählen
            </p>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full p-3 rounded-lg outline-none"
              style={{
                background: "rgba(107, 103, 92, 0.3)",
                border: "1px solid rgba(156, 163, 175, 0.2)",
                color: "#e5e7eb",
                fontSize: "0.875rem",
              }}
            >
              {modelOptions.map((o) => (
                <option key={o.value} value={o.value} style={optionStyle}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.12)" }}>
            <p style={{ color: "#f87171", fontSize: "0.875rem" }}>{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Modell-Basisinformationen (wie Kommilitonin) */}
      <div
        className="p-6 rounded-[14px] shadow-lg"
        style={{ background: "#232421", boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)" }}
      >
        <h2 className="mb-4" style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>
          Modell-Basisinformationen
        </h2>

        <div className="grid grid-cols-4 gap-6">
          <div>
            <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginBottom: "0.5rem" }}>Modell</p>
            <p style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
              {modelOptions.find((m) => m.value === selectedModel)?.label ?? selectedModel}
            </p>
          </div>

          <div>
            <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginBottom: "0.5rem" }}>Quelle</p>
            <p style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>Backend (/evaluate_model)</p>
          </div>

          <div>
            <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginBottom: "0.5rem" }}>Datensatz</p>
            <p style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>AI4I 2020</p>
          </div>

          <div>
            <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginBottom: "0.5rem" }}>Klassenverteilung</p>
            <p style={{ color: "#f59e0b", fontSize: "0.875rem" }}>3.39% Failure</p>
          </div>
        </div>
      </div>

      {/* KPI Row (wie Kommilitonin: 4 KPIs) */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Accuracy", value: loading ? "Loading..." : fmtPct(metrics.accuracy), sub: "Testdaten" },
          { label: "F1-Score", value: loading ? "Loading..." : fmtPct(metrics.f1), sub: "Balanced" },
          { label: "Precision", value: loading ? "Loading..." : fmtPct(metrics.precision), sub: "Class: Failure" },
          { label: "Recall", value: loading ? "Loading..." : fmtPct(metrics.recall), sub: "Class: Failure" },
        ].map((k) => (
          <div
            key={k.label}
            className="p-5 rounded-[14px] shadow-lg"
            style={{ background: "#232421", boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)" }}
          >
            <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginBottom: "0.5rem" }}>{k.label}</p>
            <p style={{ color: "#e5e7eb", fontSize: "1.625rem", fontWeight: 600 }}>{k.value}</p>
            <p style={{ color: "#9ca3af", fontSize: "0.75rem" }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Confusion Matrix + Derived KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className="p-6 rounded-[14px] shadow-lg"
          style={{ background: "#232421", boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)" }}
        >
          <h2 className="mb-4" style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>
            Confusion Matrix
          </h2>
          {tn !== null && fp !== null && fn !== null && tp !== null ? (
            <div className="rounded-lg overflow-auto" style={{ background: "#1f201d" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                      Actual \\ Predicted
                    </th>
                    <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                      Kein Ausfall
                    </th>
                    <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                      Ausfall
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <td className="px-4 py-3" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                      Kein Ausfall
                    </td>
                    <td className="px-4 py-3" style={{ color: "#22c55e", fontSize: "0.875rem" }}>
                      {tn}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#f59e0b", fontSize: "0.875rem" }}>
                      {fp}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                      Ausfall
                    </td>
                    <td className="px-4 py-3" style={{ color: "#f59e0b", fontSize: "0.875rem" }}>
                      {fn}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#ef4444", fontSize: "0.875rem" }}>
                      {tp}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 rounded-lg" style={{ background: "rgba(156,163,175,0.10)" }}>
              <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>Confusion Matrix nicht verfuegbar</p>
            </div>
          )}
        </div>

        <div className="grid grid-rows-2 gap-4">
          <div
            className="p-5 rounded-[14px] shadow-lg"
            style={{ background: "#232421", boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)" }}
          >
            <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
              Specificity (TNR)
            </p>
            <p style={{ color: "#e5e7eb", fontSize: "1.625rem", fontWeight: 600 }}>
              {specificity !== null ? `${Math.round(specificity * 100)}%` : "â€”"}
            </p>
            <p style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
              TN / (TN + FP)
            </p>
          </div>
          <div
            className="p-5 rounded-[14px] shadow-lg"
            style={{ background: "#232421", boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)" }}
          >
            <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
              False Alarm Rate (FPR)
            </p>
            <p style={{ color: "#e5e7eb", fontSize: "1.625rem", fontWeight: 600 }}>
              {falseAlarmRate !== null ? `${Math.round(falseAlarmRate * 100)}%` : "â€”"}
            </p>
            <p style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
              FP / (FP + TN)
            </p>
          </div>
        </div>
      </div>

      {/* ROC + Feature Importances */}
      <div className="grid grid-cols-2 gap-4">
        {/* ROC Curve */}
        <div
          className="p-6 rounded-[14px] shadow-lg"
          style={{ background: "#232421", boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>ROC Curve</h2>
            <div className="text-right">
              <p style={{ color: "#9ca3af", fontSize: "0.75rem" }}>AUC Score</p>
              <p style={{ color: "#22d3ee", fontSize: "1.5rem", fontWeight: 600 }}>
                {loading ? "_" : fmtAuc(metrics.roc_auc)}
              </p>
            </div>
          </div>

          {rocPoints.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={rocPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="fpr"
                  stroke="#9ca3af"
                  type="number"
                  domain={[0, 1]}
                  tick={{ fontSize: 12 }}
                  label={{ value: "False Positive Rate", position: "bottom", fill: "#9ca3af", fontSize: 12 }}
                />
                <YAxis
                  dataKey="tpr"
                  stroke="#9ca3af"
                  type="number"
                  domain={[0, 1]}
                  tick={{ fontSize: 12 }}
                  label={{ value: "True Positive Rate", angle: -90, position: "left", fill: "#9ca3af", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{ background: "#232421", border: "1px solid rgba(255,255,255,0.1)", fontSize: "0.875rem" }}
                  labelStyle={{ color: "#e5e7eb" }}
                  formatter={(value: any, name: any) => [Number(value).toFixed(3), name]}
                />
                <Line type="monotone" dataKey="tpr" stroke="#22d3ee" strokeWidth={3} dot={false} isAnimationActive={false} name="ROC" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="p-4 rounded-lg" style={{ background: "rgba(156,163,175,0.10)" }}>
              <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>ROC-Punkte nicht verf?gbar</p>
            </div>
          )}
        </div>

        {/* Feature Importances */}
        <div
          className="p-6 rounded-[14px] shadow-lg"
          style={{ background: "#232421", boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)" }}
        >
          <h2 className="mb-4" style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>
            Feature Importances
          </h2>

          {importances && importances.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={importances} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis type="number" stroke="#9ca3af" style={{ fontSize: "0.75rem" }} />
                <YAxis dataKey="feature" type="category" stroke="#9ca3af" width={120} style={{ fontSize: "0.75rem" }} />
                <Tooltip contentStyle={{ background: "#232421", border: "1px solid rgba(255,255,255,0.1)", fontSize: "0.875rem" }} labelStyle={{ color: "#e5e7eb" }} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                  {importances.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? "#22d3ee" : "#a78bfa"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="p-4 rounded-lg" style={{ background: "rgba(156,163,175,0.10)" }}>
              <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>Feature Importances nicht verf?gbar</p>
            </div>
          )}
        </div>
      </div>

      {evalResult?.classification_report && (
        <details
          className="p-6 rounded-[14px] shadow-lg"
          style={{ background: "#232421", boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)" }}
        >
          <summary style={{ color: "#e5e7eb", fontSize: "1.125rem", cursor: "pointer" }}>
            Details (Classification Report)
          </summary>
          <pre style={{ color: "#9ca3af", fontSize: "0.8rem", marginTop: 12, whiteSpace: "pre-wrap" }}>
            {evalResult.classification_report}
          </pre>
        </details>
      )}
      <footer className="pt-8 pb-6 text-center" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
        © 2025 – Projekt 2 • Predictive Analysis for Maintenance
      </footer>
    </div>
  );
}

