import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../api/client";

/**
 * Global UI state for protected pages:
 * - Prediction config persisted in `localStorage`
 * - Warning log persisted in `sessionStorage`
 * - Polling `/predict/latest` to create warning entries + show critical alerts
 */
export type WarningLogEntry = {
  time: string;
  mode: string;
  failureProbability: string;
  severity: "Hoch" | "Mittel" | "Niedrig";
  recommendation: string;
};

type PredictionConfig = {
  modelName: string;
  interval: number;
  batchSize: number;
};

type PredictionConfigMeta = {
  modelEdited: boolean;
  intervalEdited: boolean;
  batchEdited: boolean;
};

type AppStateContextValue = {
  predictionConfig: PredictionConfig;
  predictionConfigMeta: PredictionConfigMeta;
  setModelName: (value: string) => void;
  setPredictionInterval: (value: number) => void;
  setBatchSize: (value: number) => void;
  markConfigEdited: (key: "model" | "interval" | "batch") => void;
  warningLog: WarningLogEntry[];
  clearWarnings: () => void;
  removeWarningsByIndex: (indices: number[]) => void;
  warningsView: WarningLogEntry[];
  warningsLoading: boolean;
  isLogOpen: boolean;
  openLog: () => void;
  closeLog: () => void;
  isRedAlertOpen: boolean;
  redAlertData: WarningLogEntry | null;
  dismissRedAlert: () => void;
};

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

const DEFAULT_CONFIG: PredictionConfig = {
  modelName: "Random_Forest",
  interval: 1.0,
  batchSize: 50,
};

const CONFIG_STORAGE_KEY = "pms.prediction.config";
const WARNING_LOG_KEY = "pms.warningLog.v1";

const isValidWarning = (value: unknown): value is WarningLogEntry => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const severity = candidate.severity;
  return (
    typeof candidate.time === "string" &&
    typeof candidate.mode === "string" &&
    typeof candidate.failureProbability === "string" &&
    typeof candidate.recommendation === "string" &&
    (severity === "Hoch" || severity === "Mittel" || severity === "Niedrig")
  );
};

const readStoredConfig = (): PredictionConfig => {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<PredictionConfig>;
    return {
      modelName: typeof parsed.modelName === "string" ? parsed.modelName : DEFAULT_CONFIG.modelName,
      interval: typeof parsed.interval === "number" ? parsed.interval : DEFAULT_CONFIG.interval,
      batchSize: typeof parsed.batchSize === "number" ? parsed.batchSize : DEFAULT_CONFIG.batchSize,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
};

const readStoredWarningLog = (): WarningLogEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(WARNING_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const filtered = parsed.filter(isValidWarning) as WarningLogEntry[];
    return filtered;
  } catch {
    return [];
  }
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

const mapSeverity = (light: string): WarningLogEntry["severity"] => {
  if (light === "red") return "Hoch";
  if (light === "yellow") return "Mittel";
  return "Niedrig";
};

const mapRecommendation = (light: string): string => {
  if (light === "red") return "Sofort pruefen / Wartung einleiten";
  if (light === "yellow") return "Beobachten und zeitnah pruefen";
  return "Keine Aktion erforderlich";
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

/** Provider for prediction config + warning log state (used across the protected UI). */
export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [predictionConfig, setPredictionConfig] = useState<PredictionConfig>(readStoredConfig);
  const [predictionConfigMeta, setPredictionConfigMeta] = useState<PredictionConfigMeta>({
    modelEdited: false,
    intervalEdited: false,
    batchEdited: false,
  });

  const [warningLog, setWarningLog] = useState<WarningLogEntry[]>(readStoredWarningLog);
  const [warningsLoading, setWarningsLoading] = useState(true);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isRedAlertOpen, setIsRedAlertOpen] = useState(false);
  const [redAlertData, setRedAlertData] = useState<WarningLogEntry | null>(null);

  const lastWarningKeyRef = useRef<string | null>(null);
  const lastRedWarningKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(predictionConfig));
    } catch {
      // ignore storage errors
    }
  }, [predictionConfig]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(WARNING_LOG_KEY, JSON.stringify(warningLog));
    } catch {
      // ignore storage errors
    }
  }, [warningLog]);

  const setModelName = (value: string) =>
    setPredictionConfig((prev) => ({ ...prev, modelName: value }));
  const setPredictionInterval = (value: number) =>
    setPredictionConfig((prev) => ({ ...prev, interval: value }));
  const setBatchSize = (value: number) =>
    setPredictionConfig((prev) => ({ ...prev, batchSize: value }));

  const markConfigEdited = (key: "model" | "interval" | "batch") => {
    setPredictionConfigMeta((prev) => ({
      ...prev,
      modelEdited: key === "model" ? true : prev.modelEdited,
      intervalEdited: key === "interval" ? true : prev.intervalEdited,
      batchEdited: key === "batch" ? true : prev.batchEdited,
    }));
  };

  const clearWarnings = () => setWarningLog([]);

  const removeWarningsByIndex = (indices: number[]) => {
    if (indices.length === 0) return;
    const toRemove = new Set(indices);
    setWarningLog((prev) => prev.filter((_, idx) => !toRemove.has(idx)));
  };

  // Poll backend for the latest prediction record and derive warning entries for the UI.
  useEffect(() => {
    let alive = true;
    let inFlight = false;

    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const latestRes = await api.getPredictionLatest();
        const latest = (latestRes as { latest?: any } | undefined)?.latest ?? null;
        if (!latest) return;

        const lightRaw = String(latest?.traffic_light ?? "").toLowerCase();
        const tl =
          lightRaw === "green" || lightRaw === "yellow" || lightRaw === "red" ? lightRaw : null;
        if (!tl || tl === "green") return;

        const tsRaw = latest?.TS ?? latest?.ts ?? latest?.timestamp ?? null;
        const parsedTs = parseTimestamp(tsRaw);
        const time = parsedTs ? formatTime(parsedTs.ts) : "-";
        const warningKey =
          String(latest?.UDI ?? latest?.id ?? latest?.product_id ?? "") +
          `|${tsRaw ?? ""}|${tl}|${latest?.predicted_label ?? ""}`;
        const rawProb =
          latest?.stage1_probability ??
          latest?.probability ??
          latest?.probability_failure ??
          latest?.probabilityFailure ??
          null;
        const prob = parseProbability(rawProb);
        const probText = prob == null ? "—" : `${(prob * 100).toFixed(1)}%`;

        if (warningKey === lastWarningKeyRef.current) return;
        lastWarningKeyRef.current = warningKey;

        const entry: WarningLogEntry = {
          time,
          mode:
            latest?.failure_type_pred ??
            latest?.failure_mode ??
            (latest?.predicted_label === 1 ? "Failure" : "Warning"),
          failureProbability: probText,
          severity: mapSeverity(tl),
          recommendation: mapRecommendation(tl),
        };

        setWarningLog((prev) => [entry, ...prev]);

        if (tl === "red" && warningKey !== lastRedWarningKeyRef.current) {
          lastRedWarningKeyRef.current = warningKey;
          setRedAlertData({
            time,
            mode: latest?.failure_type_pred ?? latest?.failure_mode ?? "Failure",
            failureProbability: probText,
            severity: "Hoch",
            recommendation: mapRecommendation("red"),
          });
          setIsRedAlertOpen(true);
        }
      } catch (e: any) {
        if (!(e instanceof ApiError && (e.status === 204 || e.status === 404))) {
          // ignore other errors for now
        }
      } finally {
        if (alive) setWarningsLoading(false);
        inFlight = false;
      }
    };

    void poll();
    const pollMsRaw =
      typeof window !== "undefined"
        ? window.localStorage.getItem("pms.settings.pollMs")
        : null;
    const pollMs = pollMsRaw ? Math.max(500, Number(pollMsRaw)) : 2000;
    const id = setInterval(poll, Number.isFinite(pollMs) ? pollMs : 2000);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const warningsView = useMemo(() => warningLog.slice(0, 10), [warningLog]);

  const value = useMemo<AppStateContextValue>(
    () => ({
      predictionConfig,
      predictionConfigMeta,
      setModelName,
      setPredictionInterval,
      setBatchSize,
      markConfigEdited,
      warningLog,
      clearWarnings,
      removeWarningsByIndex,
      warningsView,
      warningsLoading,
      isLogOpen,
      openLog: () => setIsLogOpen(true),
      closeLog: () => setIsLogOpen(false),
      isRedAlertOpen,
      redAlertData,
      dismissRedAlert: () => setIsRedAlertOpen(false),
    }),
    [
      predictionConfig,
      predictionConfigMeta,
      warningLog,
      clearWarnings,
      removeWarningsByIndex,
      warningsView,
      warningsLoading,
      isLogOpen,
      isRedAlertOpen,
      redAlertData,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

/** Access app-wide state (prediction config + warning log). */
export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
