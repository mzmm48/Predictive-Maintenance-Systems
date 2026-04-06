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

type EvalStage2Response = {
  model_name: string;
  task: string;
  metrics?: {
    accuracy?: number;
    balanced_accuracy?: number;
    precision_macro?: number;
    recall_macro?: number;
    f1_macro?: number;
    precision_weighted?: number;
    recall_weighted?: number;
    f1_weighted?: number;
  };
  confusion_matrix?: {
    labels?: string[];
    matrix?: number[][];
  };
  classification_report?: string;
};

/** Model evaluation dashboard (metrics, ROC curve, feature importances). */
export function ModelInsightsPage() {
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
  // UI tab state: switches between binary failure metrics (stage1) and failure-type metrics (stage2).
  const [activeTab, setActiveTab] = useState<"stage1" | "stage2">("stage1");
  const [loadingStage1, setLoadingStage1] = useState(true);
  const [loadingStage2, setLoadingStage2] = useState(true);
  const [errorStage1, setErrorStage1] = useState<string | null>(null);
  const [errorStage2, setErrorStage2] = useState<string | null>(null);
  const [evalStage1, setEvalStage1] = useState<EvaluateModelResponse | null>(null);
  const [evalStage2, setEvalStage2] = useState<EvalStage2Response | null>(null);

  const [metricsStage1, setMetricsStage1] = useState<{
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
  const [metricsStage2, setMetricsStage2] = useState<{
    accuracy: number | null;
    balanced_accuracy: number | null;
    precision_macro: number | null;
    recall_macro: number | null;
    f1_macro: number | null;
    precision_weighted: number | null;
    recall_weighted: number | null;
    f1_weighted: number | null;
  }>({
    accuracy: null,
    balanced_accuracy: null,
    precision_macro: null,
    recall_macro: null,
    f1_macro: null,
    precision_weighted: null,
    recall_weighted: null,
    f1_weighted: null,
  });
  const optionStyle = { color: "#111827", background: "#f3f4f6" };
  // Load both stage evaluations whenever the selected model changes.
  useEffect(() => {
    let alive = true;

    // Stage 1 evaluation: binary machine-failure metrics from /evaluate_model.
    const loadStage1 = async () => {
      try {
        setLoadingStage1(true);
        setErrorStage1(null);

        const res = (await api.evaluateModel(selectedModel)) as EvaluateModelResponse;
        if (!alive) return;
        setEvalStage1(res);

        const m = res?.metrics ?? {};
        setMetricsStage1({
          accuracy: typeof m.accuracy === "number" ? m.accuracy : null,
          f1: typeof m.f1 === "number" ? m.f1 : null,
          precision: typeof m.precision === "number" ? m.precision : null,
          recall: typeof m.recall === "number" ? m.recall : null,
          roc_auc: typeof m.roc_auc === "number" ? m.roc_auc : null,
        });
      } catch (e: any) {
        if (!alive) return;
        setEvalStage1(null);
        setMetricsStage1({
          accuracy: null,
          f1: null,
          precision: null,
          recall: null,
          roc_auc: null,
        });
        setErrorStage1(e?.message ?? "Fehler beim Laden der Stage-1-Metriken.");
      } finally {
        if (alive) setLoadingStage1(false);
      }
    };

    // Stage 2 evaluation: failure-type metrics from /evaluate_failure_type.
    const loadStage2 = async () => {
      try {
        setLoadingStage2(true);
        setErrorStage2(null);

        const stage2ModelName = `${selectedModel}_FailureType`;
        const res = (await api.evaluateFailureType(stage2ModelName)) as EvalStage2Response;
        if (!alive) return;
        setEvalStage2(res);

        const m = res?.metrics ?? {};
        setMetricsStage2({
          accuracy: typeof m.accuracy === "number" ? m.accuracy : null,
          balanced_accuracy: typeof m.balanced_accuracy === "number" ? m.balanced_accuracy : null,
          precision_macro: typeof m.precision_macro === "number" ? m.precision_macro : null,
          recall_macro: typeof m.recall_macro === "number" ? m.recall_macro : null,
          f1_macro: typeof m.f1_macro === "number" ? m.f1_macro : null,
          precision_weighted: typeof m.precision_weighted === "number" ? m.precision_weighted : null,
          recall_weighted: typeof m.recall_weighted === "number" ? m.recall_weighted : null,
          f1_weighted: typeof m.f1_weighted === "number" ? m.f1_weighted : null,
        });
      } catch (e: any) {
        if (!alive) return;
        setEvalStage2(null);
        setMetricsStage2({
          accuracy: null,
          balanced_accuracy: null,
          precision_macro: null,
          recall_macro: null,
          f1_macro: null,
          precision_weighted: null,
          recall_weighted: null,
          f1_weighted: null,
        });
        setErrorStage2(e?.message ?? "Fehler beim Laden der Stage-2-Metriken.");
      } finally {
        if (alive) setLoadingStage2(false);
      }
    };

    loadStage1();
    loadStage2();

    // Optional: leichter Live-Refresh (Demo), damit die UI aktuell bleibt.
    const id = setInterval(() => {
      loadStage1();
      loadStage2();
    }, 10000);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [selectedModel]);

  const fmtPct = (v: number | null) =>
    typeof v === "number" ? `${Math.round(v * 100)}%` : "â€”";

  const fmtAuc = (v: number | null) =>
    typeof v === "number" ? v.toFixed(2) : "_";

  const loading = activeTab === "stage1" ? loadingStage1 : loadingStage2;
  const errorMsg = activeTab === "stage1" ? errorStage1 : errorStage2;

  const rocPoints = evalStage1?.roc_curve?.points ?? [];
  const importances = evalStage1?.feature_importances ?? null;
  const confusion = evalStage1?.confusion_matrix as
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
  const stage2Confusion = evalStage2?.confusion_matrix ?? null;
  const stage2Labels = stage2Confusion?.labels ?? [];
  const stage2Matrix = stage2Confusion?.matrix ?? [];
  const stage2Report = evalStage2?.classification_report ?? "";

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
              Modell auswÃ¤hlen
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
        {/* UI switch between both evaluation layers. */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setActiveTab("stage1")}
            className="px-4 py-2 rounded-lg text-sm"
            style={{
              background: activeTab === "stage1" ? "#22d3ee" : "rgba(107, 103, 92, 0.3)",
              color: activeTab === "stage1" ? "#111827" : "#e5e7eb",
              border: "1px solid rgba(156, 163, 175, 0.2)",
            }}
          >
            Stage 1
          </button>
          <button
            onClick={() => setActiveTab("stage2")}
            className="px-4 py-2 rounded-lg text-sm"
            style={{
              background: activeTab === "stage2" ? "#22d3ee" : "rgba(107, 103, 92, 0.3)",
              color: activeTab === "stage2" ? "#111827" : "#e5e7eb",
              border: "1px solid rgba(156, 163, 175, 0.2)",
            }}
          >
            Stage 2
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.12)" }}>
            <p style={{ color: "#f87171", fontSize: "0.875rem" }}>{errorMsg}</p>
          </div>
        )}
      </div>

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
            <p style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
              {activeTab === "stage1" ? "Backend (/evaluate_model)" : "Backend (/evaluate_failure_type)"}
            </p>
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

      {/* KPI cards differ by active tab: stage1 shows binary metrics, stage2 shows multiclass metrics. */}
      <div className="grid grid-cols-4 gap-4">
        {(activeTab === "stage1"
          ? [
              { label: "Accuracy", value: loading ? "Loading..." : fmtPct(metricsStage1.accuracy), sub: "Testdaten" },
              { label: "F1-Score", value: loading ? "Loading..." : fmtPct(metricsStage1.f1), sub: "Class: Failure" },
              { label: "Precision", value: loading ? "Loading..." : fmtPct(metricsStage1.precision), sub: "Class: Failure" },
              { label: "Recall", value: loading ? "Loading..." : fmtPct(metricsStage1.recall), sub: "Class: Failure" },
            ]
          : [
              { label: "Accuracy", value: loading ? "Loading..." : fmtPct(metricsStage2.accuracy), sub: "Stage 2" },
              { label: "Balanced Acc.", value: loading ? "Loading..." : fmtPct(metricsStage2.balanced_accuracy), sub: "Klassenbalanciert" },
              { label: "F1 Macro", value: loading ? "Loading..." : fmtPct(metricsStage2.f1_macro), sub: "Alle Klassen gleich" },
              { label: "F1 Weighted", value: loading ? "Loading..." : fmtPct(metricsStage2.f1_weighted), sub: "Gewichtet" },
            ]).map((k) => (
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

      {/* Stage 1: classic 2x2 confusion matrix for failure vs no-failure. */}
      {activeTab === "stage1" && (
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
                {specificity !== null ? `${Math.round(specificity * 100)}%` : "Ã¢â‚¬â€"}
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
                {falseAlarmRate !== null ? `${Math.round(falseAlarmRate * 100)}%` : "Ã¢â‚¬â€"}
              </p>
              <p style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                FP / (FP + TN)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stage 2: multiclass confusion matrix for failure types (HDF/OSF/PWF/TWF...). */}
      {activeTab === "stage2" && (
        <div
          className="p-6 rounded-[14px] shadow-lg"
          style={{ background: "#232421", boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)" }}
        >
          <h2 className="mb-4" style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>
            Confusion Matrix
          </h2>
          {stage2Labels.length > 0 && stage2Matrix.length > 0 ? (
            <div className="rounded-lg overflow-auto" style={{ background: "#1f201d" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <th className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                      Actual \ Predicted
                    </th>
                    {stage2Labels.map((l) => (
                      <th key={`h-${l}`} className="px-4 py-3 text-left" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stage2Matrix.map((row, i) => (
                    <tr key={`r-${stage2Labels[i] ?? i}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <td className="px-4 py-3" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                        {stage2Labels[i] ?? `Klasse ${i}`}
                      </td>
                      {row.map((v, j) => (
                        <td key={`c-${i}-${j}`} className="px-4 py-3" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 rounded-lg" style={{ background: "rgba(156,163,175,0.10)" }}>
              <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>Confusion Matrix nicht verfuegbar</p>
            </div>
          )}
        </div>
      )}

      {/* Stage 1-only charts: ROC and feature importances are generated by /evaluate_model. */}
      {activeTab === "stage1" && (
        <div className="grid grid-cols-2 gap-4">
          <div
            className="p-6 rounded-[14px] shadow-lg"
            style={{ background: "#232421", boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>ROC Curve</h2>
              <div className="text-right">
                <p style={{ color: "#9ca3af", fontSize: "0.75rem" }}>AUC Score</p>
                <p style={{ color: "#22d3ee", fontSize: "1.5rem", fontWeight: 600 }}>
                  {loading ? "_" : fmtAuc(metricsStage1.roc_auc)}
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
                <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>ROC-Punkte nicht verfuegbar</p>
              </div>
            )}
          </div>
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
                <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>Feature Importances nicht verfuegbar</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Stage 2-only text report: per-class precision/recall/f1 from /evaluate_failure_type. */}
      {activeTab === "stage2" && (
        <div
          className="p-6 rounded-[14px] shadow-lg"
          style={{ background: "#232421", boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)" }}
        >
          <h2 className="mb-4" style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>
            Classification Report
          </h2>
          {stage2Report ? (
            <pre
              style={{
                color: "#e5e7eb",
                fontSize: "0.78rem",
                background: "#1f201d",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "12px",
                borderRadius: "8px",
                overflowX: "auto",
              }}
            >
              {stage2Report}
            </pre>
          ) : (
            <div className="p-4 rounded-lg" style={{ background: "rgba(156,163,175,0.10)" }}>
              <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>Classification Report nicht verfuegbar</p>
            </div>
          )}
        </div>
      )}
      <footer className="pt-8 pb-6 text-center" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
        Â© 2025 â€“ Projekt 2 â€¢ Predictive Analysis for Maintenance
      </footer>
    </div>
  );
}
