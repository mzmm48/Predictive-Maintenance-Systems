from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
MODELS_DIR = BASE_DIR / "data" / "models"


def load_model_artifact(model_name: str) -> dict:
    model_path = MODELS_DIR / f"{model_name}.pkl"
    with open(model_path, "rb") as f:
        return pickle.load(f)

# kann ich evt vereinfachen in predict-worker.py zu -> stage2_name = f"{model_name}_FailureType"
def stage2_model_name_for(stage1_model_name: str) -> str:
    return f"{stage1_model_name}_FailureType"


def align_features(x: pd.DataFrame, feature_names: list[str]) -> pd.DataFrame:
    missing = [c for c in feature_names if c not in x.columns]
    if missing:
        raise ValueError(f"Fehlende Features in x_test: {missing}")
    return x[feature_names]


def _binary_score(model, x: pd.DataFrame) -> np.ndarray | None:
    if hasattr(model, "predict_proba"):
        prob = model.predict_proba(x)
        if prob is not None and getattr(prob, "ndim", 0) == 2 and prob.shape[1] > 1:
            return prob[:, 1]
    if hasattr(model, "decision_function"):
        scores = model.decision_function(x)
        return 1 / (1 + np.exp(-scores))
    return None


def do_prediction(x_test, y_test=None, model_name: str = "Random_Forest", threshold: float = 0.5):
    artifact = load_model_artifact(model_name)
    model = artifact["model"]
    feature_names = artifact["features"]

    if isinstance(x_test, pd.DataFrame):
        x_test = align_features(x_test, feature_names)

    y_prob = _binary_score(model, x_test)
    if y_prob is not None:
        y_pred = (y_prob >= threshold).astype(int)
    else:
        y_pred = model.predict(x_test)
    return y_pred, y_prob


def predict_failure_type(
    x_test: pd.DataFrame,
    model_name: str = "Random_Forest_FailureType",
) -> tuple[np.ndarray, np.ndarray]:
    artifact = load_model_artifact(model_name)
    model = artifact["model"]
    feature_names = artifact["features"]
    classes = artifact.get("classes")

    x_aligned = align_features(x_test, feature_names)
    if not hasattr(model, "predict_proba"):
        labels = model.predict(x_aligned)
        return labels, np.asarray([None] * len(labels), dtype=object)

    prob = model.predict_proba(x_aligned) # liefert für jede Zeile eine Liste von Wahrscheinlichkeiten über alle Fehlerklassen (z. B. HDF/OSF/PWF/TWF)
    pred_idx = np.argmax(prob, axis=1) # Auswahl der Klasse mit der höchsten Wahrscheinlichkeit für jede Zeile
    pred_prob = prob[np.arange(len(pred_idx)), pred_idx] # zugehörige Wahrscheinlichkeit der vorhergesagten Klasse

    if classes is None:
        if hasattr(model, "classes_"):
            classes = list(model.classes_)
        else:
            classes = [str(i) for i in range(prob.shape[1])]

    labels = np.array([classes[i] for i in pred_idx], dtype=object)

    return labels, pred_prob.astype(float)
