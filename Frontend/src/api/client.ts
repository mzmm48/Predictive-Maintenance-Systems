/// <reference types="vite/client" />

const DEFAULT_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const API_BASE_STORAGE_KEY = "pms.settings.apiBase";

function getApiBaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_API_BASE_URL;
  try {
    const stored = window.localStorage.getItem(API_BASE_STORAGE_KEY);
    return stored && stored.trim() ? stored.trim() : DEFAULT_API_BASE_URL;
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

/** Error with HTTP status and response body (useful for UI error messages). */
export class ApiError extends Error {
  readonly status: number;
  readonly bodyText: string;

  constructor(status: number, bodyText: string) {
    super(`API error ${status}: ${bodyText}`);
    this.status = status;
    this.bodyText = bodyText;
  }
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split("=").slice(1).join("=")) || null;
}

/**
 * Minimal fetch wrapper used by the whole frontend.
 * - Always sends cookies (`credentials: "include"`) for the HttpOnly session cookie.
 * - Adds the CSRF token header for mutating requests (double-submit cookie pattern).
 * @param path API path (e.g. `/auth/me`)
 * @param options `fetch` options (method, headers, body, ...)
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = String(options.method ?? "GET").toUpperCase();
  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const csrfToken = isMutating ? getCookieValue("pms_csrf") : null;

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(isMutating && csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");

    // Global hook: if the session is invalid, redirect UI to login.
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }

    throw new ApiError(res.status, text || res.statusText);
  }

  // 204 (No Content) -> no JSON body to parse
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    // Some endpoints might return plain text.
    return text as unknown as T;
  }
}

// ----- Types -----

export type ColumnName =
  | "Torque [Nm]"
  | "Rotational speed [rpm]"
  | "Air temperature [K]"
  | "Process temperature [K]"
  | "Tool wear [min]"
  | "Machine failure";

export const COLUMN_NAMES = {
  torque: "Torque [Nm]" as ColumnName,
  rpm: "Rotational speed [rpm]" as ColumnName,
  airTemp: "Air temperature [K]" as ColumnName,
  procTemp: "Process temperature [K]" as ColumnName,
  toolWear: "Tool wear [min]" as ColumnName,
  machineFailure: "Machine failure" as ColumnName,
};

export interface GetDataResponse {
  row_count: number;
  data: Record<string, unknown>[];
}

export interface FailurePrediction {
  index: number;
  true_label: number;
  predicted_label: number;
  probability_failure: number | null;
}

export interface PredictResponse {
  model_name: string;
  total_samples: number;
  failure_predictions_count: number;
  failure_predictions: FailurePrediction[];
}

export interface PredictLatestResponse {
  running: boolean;
  model_name?: string;
  interval?: number;
  batch_size?: number;
  stage1_threshold?: number;
  latest?: any;
  summary?: any;
}

export interface PredictStatusResponse {
  running: boolean;
  model_name?: string;
  interval?: number;
  batch_size?: number;
  stage1_threshold?: number;
  last_result?: any;
}

export interface EvaluateModelResponse {
  model_name: string;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    roc_auc: number | null;
  };
  roc_curve?: { points: { fpr: number; tpr: number }[] };
  feature_importances?: { feature: string; value: number }[] | null;
  confusion_matrix?: any;
  classification_report?: string;
}

// ----- API -----

export const api = {
  // Data
  getData(limit: number, columns?: ColumnName[]) {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (columns) {
      for (const col of columns) params.append("columns", col);
    }
    return request<GetDataResponse>(`/getdata?${params.toString()}`);
  },

  // Offline test-set failures (Backend: /predict_testset_failures)
  getFailurePredictions(modelName = "Random_Forest") {
    const params = new URLSearchParams({ model_name: modelName });
    return request<PredictResponse>(`/predict_testset_failures?${params.toString()}`);
  },

  // Prediction service control
  startPrediction(
    interval = 1.0,
    modelName = "Random_Forest",
    batchSize = 50,
    stage1Threshold = 0.5
  ) {
    const params = new URLSearchParams({
      interval: String(interval),
      model_name: modelName,
      batch_size: String(batchSize),
      stage1_threshold: String(stage1Threshold),
    });
    return request<any>(`/predict/start?${params.toString()}`, { method: "POST" });
  },

  stopPrediction() {
    return request<any>(`/predict/stop`, { method: "POST" });
  },

  getPredictionStatus() {
    return request<PredictStatusResponse>(`/predict/status`);
  },

  getPredictionLatest() {
    return request<PredictLatestResponse>(`/predict/latest`);
  },

  predictOnce(
    modelName = "Random_Forest",
    batchSize = 50,
    stage1Threshold = 0.5
  ) {
    const params = new URLSearchParams({
      model_name: modelName,
      batch_size: String(batchSize),
      stage1_threshold: String(stage1Threshold),
    });
    return request<any>(`/predict/once?${params.toString()}`, { method: "POST" });
  },

  // Simulation control
  startSimulation(interval = 1.0) {
    const params = new URLSearchParams({ interval: String(interval) });
    return request<any>(`/simulation/start?${params.toString()}`, { method: "POST" });
  },

  stopSimulation() {
    return request<any>(`/simulation/stop`, { method: "POST" });
  },

  getSimulationStatus() {
    return request<any>(`/simulation/status`);
  },

  resetSimulation() {
    return request<any>(`/simulation/reset`, { method: "POST" });
  },

  // Evaluation (Backend: /evaluate_model)
  evaluateModel(modelName = "Random_Forest") {
    const params = new URLSearchParams({ model_name: modelName });
    return request<EvaluateModelResponse>(`/evaluate_model?${params.toString()}`);
  },

  evaluateFailureType(modelName = "Random_Forest_FailureType") {
    const params = new URLSearchParams({ model_name: modelName });
    return request<any>(`/evaluate_failure_type?${params.toString()}`);
  },

  // Auth (HttpOnly Cookie JWT)
  auth: {
    login(username: string, password: string) {
      return request<{ ok: boolean; username?: string; role?: string }>(`/auth/login`, {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
    },

    logout() {
      return request<{ ok: boolean }>(`/auth/logout`, { method: "POST" });
    },

    me() {
      return request<{ ok: boolean; username: string; role?: string }>(`/auth/me`);
    },
  },
};
