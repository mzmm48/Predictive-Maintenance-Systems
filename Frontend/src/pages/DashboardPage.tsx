import { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { api, ApiError } from "../api/client";
import { useAppState } from "../context/AppStateContext";

type TrendPoint = {
  ts: number;
  torque: number | null;
  speed: number | null;
  temp: number | null;
};

export function DashboardPage() {
  // --- Trend + KPI (wie Kommilitonin) ---
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [avgTorque, setAvgTorque] = useState<number | null>(null);
  const [avgToolWear, setAvgToolWear] = useState<number | null>(null);
  const [trendMeta, setTrendMeta] = useState<{
    firstTs: number;
    lastTs: number;
    assumedUtc: boolean;
  } | null>(null);

  // --- Prediction KPIs ---
  const [activeWarnings, setActiveWarnings] = useState<number>(0);
  const [failureProb, setFailureProb] = useState<number | null>(null); // 0..1
  const [predLoading, setPredLoading] = useState<boolean>(true);
  const [trafficLight, setTrafficLight] = useState<"green" | "yellow" | "red" | null>(null);

  const { warningsView, warningsLoading, openLog } = useAppState();
  const lastTrendKeyRef = useRef<string>("");
  const hasLatestRef = useRef<boolean>(false);

  // --- UI helper ---
  const cardStyle = useMemo(
    () => ({
      background: "#232421",
      boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)",
    }),
    []
  );

  // Normalisiert probability: "12%", 0.12 oder 12 -> 0..1
  const parseProbability = (raw: unknown): number | null => {
    if (raw == null) return null;
    if (typeof raw === "string") {
      const cleaned = raw.trim().replace("%", "");
      const n = parseFloat(cleaned);
      if (!Number.isFinite(n)) return null;
      const normalized = n > 1 ? n / 100 : n;
      return Math.max(0, Math.min(1, normalized));
    }
    if (typeof raw === "number") {
      if (!Number.isFinite(raw)) return null;
      const normalized = raw > 1 ? raw / 100 : raw;
      return Math.max(0, Math.min(1, normalized));
    }
    return null;
  };

  const warnedMissingRef = useRef<Record<string, boolean>>({});
  const warnOnce = (key: string, message: string) => {
    if (warnedMissingRef.current[key]) return;
    warnedMissingRef.current[key] = true;
    console.warn(message);
  };

  const toNumber = (value: unknown): number | null => {
    if (value == null) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
      const normalized = value.replace(",", ".").trim();
      const n = Number(normalized);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const parseTimestamp = (raw: unknown): { ts: number; assumedUtc: boolean } | null => {
    if (!raw) return null;
    if (raw instanceof Date) {
      const t = raw.getTime();
      return Number.isFinite(t) ? { ts: t, assumedUtc: false } : null;
    }
    const s = String(raw).trim();
    if (!s) return null;
    const withT = s.includes("T") ? s : s.replace(" ", "T");
    const hasTz = /[zZ]|[+\-]\d{2}:?\d{2}$/.test(withT);
    const candidate = hasTz ? withT : `${withT}Z`;
    const date = new Date(candidate);
    const ts = date.getTime();
    if (!Number.isFinite(ts)) return null;
    return { ts, assumedUtc: !hasTz };
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();
  const formatDateTime = (ts: number) => new Date(ts).toLocaleString();

  // ============================================================
  // 1) Trend-Daten holen (api.getData) + Ø Torque / Ø Tool Wear
  // ============================================================
  useEffect(() => {
    let alive = true;
    let inFlight = false;

    const loadTrend = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const json = await api.getData(200);
        const rows = Array.isArray(json.data) ? json.data : [];

        const torqueKeys = ["Torque [Nm]", "Torque", "torque"];
        const toolWearKeys = ["Tool wear [min]", "Tool wear", "tool_wear", "toolWear", "wear"];
        const rpmKeys = ["Rotational speed [rpm]", "Rotational speed", "rpm", "rotational_speed", "speed"];
        const tempKeys = ["Process temperature [K]", "Process temperature", "proc_temp", "process_temp", "temp"];
        const tsKeys = ["TS", "ts", "timestamp", "time"];

        const hasAnyKey = (row: any, keys: string[]) => keys.some((k) => row && k in row);
        if (rows.length > 0 && !rows.some((r) => hasAnyKey(r, torqueKeys))) {
          warnOnce("missing-torque", "Dashboard KPI: Feld für Torque fehlt im /getdata Payload.");
        }
        if (rows.length > 0 && !rows.some((r) => hasAnyKey(r, toolWearKeys))) {
          warnOnce("missing-toolwear", "Dashboard KPI: Feld für Tool Wear fehlt im /getdata Payload.");
        }
        if (rows.length > 0 && !rows.some((r) => hasAnyKey(r, tsKeys))) {
          warnOnce("missing-ts", "Dashboard Charts: Feld für Timestamp (TS/ts) fehlt im /getdata Payload.");
        }

        const pick = (row: any, keys: string[]) => {
          for (const k of keys) {
            if (row && row[k] != null) return row[k];
          }
          return undefined;
        };

        const parsed = rows
          .map((row: any) => {
            const torqueVal = toNumber(pick(row, torqueKeys));
            const rpmVal = toNumber(pick(row, rpmKeys));
            const tempVal = toNumber(pick(row, tempKeys));
            const wearVal = toNumber(pick(row, toolWearKeys));
            const tsRaw = pick(row, tsKeys);
            const tsParsed = parseTimestamp(tsRaw);

            return {
              torque: torqueVal,
              speed: rpmVal,
              temp: tempVal,
              wear: wearVal,
              tsParsed,
            };
          })
          .filter((r) => r.tsParsed !== null) as Array<{
          torque: number | null;
          speed: number | null;
          temp: number | null;
          wear: number | null;
          tsParsed: { ts: number; assumedUtc: boolean };
        }>;

        if (parsed.length === 0) {
          if (!alive) return;
          setTrendData([]);
          setTrendMeta(null);
          setAvgTorque(null);
          setAvgToolWear(null);
          return;
        }

        const sorted = parsed.sort((a, b) => a.tsParsed.ts - b.tsParsed.ts);
        const latestTs = sorted[sorted.length - 1]?.tsParsed.ts ?? 0;
        const signature = `${rows.length}-${latestTs}`;
        if (signature === lastTrendKeyRef.current) return;
        lastTrendKeyRef.current = signature;

        const points: TrendPoint[] = sorted.map((r) => ({
          ts: r.tsParsed.ts,
          torque: r.torque,
          speed: r.speed,
          temp: r.temp,
        }));

        if (!alive) return;

        setTrendData(points);
        setTrendMeta({
          firstTs: sorted[0].tsParsed.ts,
          lastTs: sorted[sorted.length - 1].tsParsed.ts,
          assumedUtc: sorted.some((r) => r.tsParsed.assumedUtc),
        });

        const torqueValues = sorted
          .map((r) => r.torque)
          .filter((v) => Number.isFinite(v)) as number[];
        const wearValues = sorted
          .map((r) => r.wear)
          .filter((v) => Number.isFinite(v)) as number[];

        setAvgTorque(
          torqueValues.length > 0
            ? torqueValues.reduce((s, v) => s + v, 0) / torqueValues.length
            : null
        );
        setAvgToolWear(
          wearValues.length > 0
            ? wearValues.reduce((s, v) => s + v, 0) / wearValues.length
            : null
        );
      } catch {
        // Dashboard darf nicht crashen wenn /getdata kurz nicht da ist
      } finally {
        inFlight = false;
      }
    };

    void loadTrend();
    const id = setInterval(loadTrend, 2000);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // ============================================================
  // 2) Prediction Latest + Status holen (api.*)
  //    - Wichtig: /predict/latest kann 204 liefern -> unser client gibt dann "undefined"
  // ============================================================
  useEffect(() => {
    let alive = true;

    const loadPrediction = async () => {
      try {
        // status (running etc.)
        try {
          const status = await api.getPredictionStatus();
          // nicht zwingend needed im Dashboard-KPI hier, aber useful für warnings later
          // -> wir lassen es bewusst still
          void status;
        } catch {
          // ignore
        }

        const latestRes = await api.getPredictionLatest(); // kann undefined sein bei 204
        const latest = (latestRes as any)?.latest ?? null;

        if (!latest) {
          if (!alive) return;
          if (!hasLatestRef.current) {
            setTrafficLight(null);
            setFailureProb(null);
            setActiveWarnings(0);
          }
          return;
        }
        hasLatestRef.current = true;

        // --- Traffic light ---
        const lightRaw = String(latest?.traffic_light ?? "").toLowerCase();
        const tl =
          lightRaw === "green" || lightRaw === "yellow" || lightRaw === "red"
            ? (lightRaw as any)
            : null;

        // --- Failure probability (Backend kann probability oder probability_failure liefern) ---
        const rawProb =
          latest?.probability ??
          latest?.probability_failure ??
          latest?.probabilityFailure ??
          null;

        const p = parseProbability(rawProb);

        // --- Summary warnings (wenn vorhanden) ---
        const yellow = Number((latestRes as any)?.summary?.yellow ?? 0);
        const red = Number((latestRes as any)?.summary?.red ?? 0);
        const warningsCount =
          Number.isFinite(yellow) && Number.isFinite(red)
            ? yellow + red
            : tl === "yellow" || tl === "red"
            ? 1
            : 0;

        if (!alive) return;

        setTrafficLight(tl);
        setFailureProb(p);
        setActiveWarnings(Number.isFinite(warningsCount) ? warningsCount : 0);
      } catch (e: any) {
        // Wenn 204/404 kommt, soll UI trotzdem stabil bleiben
        if (e instanceof ApiError && (e.status === 204 || e.status === 404)) {
          if (!alive) return;
          if (!hasLatestRef.current) {
            setTrafficLight(null);
            setFailureProb(null);
            setActiveWarnings(0);
          }
          return;
        }
      } finally {
        if (alive) setPredLoading(false);
      }
    };

    void loadPrediction();
    const id = setInterval(loadPrediction, 2000);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // --- UI: Farben wie bei Kommilitonin ---
  const failureProbPct = failureProb !== null ? failureProb * 100 : null;

  const probColor =
    trafficLight === "red"
      ? "#ef4444"
      : trafficLight === "yellow"
      ? "#f59e0b"
      : trafficLight === "green"
      ? "#22c55e"
      : "#e5e7eb";

  return (
    <div className="space-y-6">
      {/* Title Section */}
      <div className="p-6 rounded-[14px] shadow-lg" style={cardStyle}>
        <h1 className="mb-2" style={{ color: "#e5e7eb", fontSize: "1.5rem" }}>
          Systemübersicht: Maschinenzustand & Vorhersagen
        </h1>
        <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
          Erkennen Sie potenzielle Ausfälle frühzeitig und optimieren Sie Ihre Wartungsplanung.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-5 rounded-[14px] shadow-lg" style={cardStyle}>
          <div className="flex items-start justify-between mb-3">
            <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>Failure Probability</p>
            <TrendingUp className="w-5 h-5" style={{ color: probColor }} />
          </div>
          <p style={{ color: probColor, fontSize: "1.625rem", fontWeight: "600" }}>
            {predLoading ? "Loading..." : failureProbPct !== null ? `${failureProbPct.toFixed(1)}%` : "—"}
          </p>
          <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginTop: "0.5rem" }}>
            Ausfallwahrscheinlichkeit (aktuelle Charge)
          </p>
        </div>

        <div className="p-5 rounded-[14px] shadow-lg" style={cardStyle}>
          <div className="flex items-start justify-between mb-3">
            <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>Aktive Warnungen</p>
            <AlertTriangle className="w-5 h-5" style={{ color: "#f59e0b" }} />
          </div>
          <p style={{ color: "#e5e7eb", fontSize: "1.625rem", fontWeight: "600" }}>{activeWarnings}</p>
          <p style={{ color: "#f59e0b", fontSize: "0.75rem", marginTop: "0.5rem" }}>
            Erfordert Aufmerksamkeit
          </p>
        </div>

        <div className="p-5 rounded-[14px] shadow-lg" style={cardStyle}>
          <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginBottom: "0.75rem" }}>Ø Tool Wear</p>
          <p style={{ color: "#e5e7eb", fontSize: "1.625rem", fontWeight: "600" }}>
            {avgToolWear !== null ? Math.round(avgToolWear) : "—"} min
          </p>
          <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginTop: "0.5rem" }}>Durchschnittlicher Verschleiß</p>
        </div>

        <div className="p-5 rounded-[14px] shadow-lg" style={cardStyle}>
          <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginBottom: "0.75rem" }}>Ø Torque</p>
          <p style={{ color: "#e5e7eb", fontSize: "1.625rem", fontWeight: "600" }}>
            {avgTorque !== null ? avgTorque.toFixed(1) : "—"} Nm
          </p>
          <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginTop: "0.5rem" }}>Durchschnittliches Drehmoment</p>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="p-6 rounded-[14px] shadow-lg" style={cardStyle}>
        <h2 className="mb-4" style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>
          Prozessparameter-Trend
        </h2>
        <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginBottom: "0.75rem" }}>
          Zeitraum:{" "}
          {trendMeta
            ? `${formatDateTime(trendMeta.firstTs)} – ${formatDateTime(trendMeta.lastTs)}${
                trendMeta.assumedUtc ? " (UTC angenommen -> lokal)" : ""
              }`
            : "-"}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Torque */}
          <div className="p-4 rounded-[12px]" style={{ background: "#1f201d" }}>
            <h3 style={{ color: "#e5e7eb", fontSize: "0.95rem", marginBottom: 8 }}>Torque [Nm]</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={["auto", "auto"]}
                  stroke="#9ca3af"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => (Number.isFinite(v) ? formatTime(Number(v)) : "")}
                />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#232421", border: "1px solid rgba(255,255,255,0.1)" }}
                  labelStyle={{ color: "#e5e7eb" }}
                  labelFormatter={(v) => (Number.isFinite(v) ? formatDateTime(Number(v)) : "")}
                  formatter={(value: any) =>
                    Number.isFinite(value) ? Number(value).toFixed(1) : "—"
                  }
                />
                <Line
                  type="monotone"
                  dataKey="torque"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Rotational Speed */}
          <div className="p-4 rounded-[12px]" style={{ background: "#1f201d" }}>
            <h3 style={{ color: "#e5e7eb", fontSize: "0.95rem", marginBottom: 8 }}>
              Rotational Speed [rpm]
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={["auto", "auto"]}
                  stroke="#9ca3af"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => (Number.isFinite(v) ? formatTime(Number(v)) : "")}
                />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#232421", border: "1px solid rgba(255,255,255,0.1)" }}
                  labelStyle={{ color: "#e5e7eb" }}
                  labelFormatter={(v) => (Number.isFinite(v) ? formatDateTime(Number(v)) : "")}
                  formatter={(value: any) =>
                    Number.isFinite(value) ? Number(value).toFixed(1) : "—"
                  }
                />
                <Line
                  type="monotone"
                  dataKey="speed"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Process Temperature */}
          <div className="p-4 rounded-[12px]" style={{ background: "#1f201d" }}>
            <h3 style={{ color: "#e5e7eb", fontSize: "0.95rem", marginBottom: 8 }}>
              Process Temperature [K]
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={["auto", "auto"]}
                  stroke="#9ca3af"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => (Number.isFinite(v) ? formatTime(Number(v)) : "")}
                />
                <YAxis
                  stroke="#9ca3af"
                  tick={{ fontSize: 10 }}
                  domain={[
                    (dataMin: number) => Math.floor(dataMin - 1),
                    (dataMax: number) => Math.ceil(dataMax + 1),
                  ]}
                />
                <Tooltip
                  contentStyle={{ background: "#232421", border: "1px solid rgba(255,255,255,0.1)" }}
                  labelStyle={{ color: "#e5e7eb" }}
                  labelFormatter={(v) => (Number.isFinite(v) ? formatDateTime(Number(v)) : "")}
                  formatter={(value: any) =>
                    Number.isFinite(value) ? Number(value).toFixed(1) : "—"
                  }
                />
                <Line
                  type="monotone"
                  dataKey="temp"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-4 flex gap-6 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: "#22d3ee" }} />
            <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Torque</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: "#a78bfa" }} />
            <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Rotational Speed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: "#f59e0b" }} />
            <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Process Temperature</span>
          </div>
        </div>
      </div>

      {/* Warnings Panel */}
      <div className="p-6 rounded-[14px] shadow-lg" style={cardStyle}>
        <div className="mb-4 flex items-center justify-between">
          <h2 style={{ color: "#e5e7eb", fontSize: "1.125rem" }}>Log Warnungen</h2>
          <button
            onClick={openLog}
            className="px-3 py-2 rounded-lg text-sm transition-all hover:opacity-90"
            style={{
              background: "rgba(34, 211, 238, 0.12)",
              color: "#22d3ee",
              border: "1px solid rgba(34, 211, 238, 0.25)",
            }}
          >
            Alle Logs anzeigen
          </button>
        </div>
        <div className="rounded-lg overflow-hidden" style={{ background: "#6b675c" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
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
                  Empfehlung
                </th>
              </tr>
            </thead>

            <tbody>
              {warningsLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-sm text-gray-400">
                    Lade Warnungen...
                  </td>
                </tr>
              )}

              {!warningsLoading && warningsView.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-sm text-gray-400">
                    Keine aktiven Warnungen
                  </td>
                </tr>
              )}

              {warningsView.map((w, index) => (
                <tr
                  key={`${w.time}-${index}`}
                  style={{
                    borderBottom:
                      index < warningsView.length - 1
                        ? "1px solid rgba(255, 255, 255, 0.05)"
                        : "none",
                  }}
                >
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
                            : "rgba(245, 158, 11, 0.2)",
                        color: w.severity === "Hoch" ? "#ef4444" : "#f59e0b",
                        fontSize: "0.75rem",
                      }}
                    >
                      {w.mode}
                    </span>
                  </td>

                  <td className="px-4 py-3" style={{ color: "#e5e7eb", fontSize: "0.875rem" }}>
                    {w.severity}
                  </td>

                  <td className="px-4 py-3" style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
                    {w.recommendation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="pt-8 pb-6 text-center" style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
        © 2025 – Projekt 2 • Predictive Analysis for Maintenance
      </footer>
    </div>
  );
}














