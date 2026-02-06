import pickle
import joblib
import numpy as np

from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
    precision_recall_fscore_support,
    roc_auc_score,
    roc_curve,
)

# Modell-Evaluation: lädt Testdaten + Modell und berechnet gängige Klassifikationsmetriken
def evaluate_model_metrics(model_name: str = "Random_Forest"):

    # Testdaten laden
    X_test = joblib.load("../data/X_test.joblib")
    y_test = joblib.load("../data/Y_test.joblib")  # achte auf Dateinamen-Konsistenz!

    with open(f"../data/models/{model_name}.pkl", "rb") as f:
        model_dict = pickle.load(f)

    model = model_dict["model"]

    # Vorhersagen
    y_pred = model.predict(X_test)

    # Score-Vektor fÃ¼r ROC (falls vorhanden)
    y_score = None
    if hasattr(model, "predict_proba"):
        prob = model.predict_proba(X_test)
        y_score = prob[:, 1] if prob is not None and prob.ndim == 2 and prob.shape[1] > 1 else None
    elif hasattr(model, "decision_function"):
        y_score = model.decision_function(X_test)

    # Grundlegende Kennzahlen
    acc = accuracy_score(y_test, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_test, y_pred, average="binary", zero_division=0
    )

    # Confusion Matrix
    cm = confusion_matrix(y_test, y_pred).tolist()  # als Liste für JSON

    # ROC-AUC falls Score vorhanden
    auc = None
    if y_score is not None:
        try:
            auc = roc_auc_score(y_test, y_score)
        except ValueError:
            auc = None

    # ROC-Punkte
    roc_points = []
    if y_score is not None:
        fpr, tpr, _ = roc_curve(y_test, y_score)
        roc_points = [{"fpr": float(f), "tpr": float(t)} for f, t in zip(fpr, tpr)]

    # Feature Importances (falls vorhanden)
    feature_names = model_dict.get("features")
    values = None
    if hasattr(model, "feature_importances_"):
        values = model.feature_importances_
    elif hasattr(model, "coef_"):
        coef = model.coef_
        values = np.abs(coef[0]) if hasattr(coef, "ndim") and coef.ndim == 2 else np.abs(coef)

    feature_importances = None
    if feature_names and values is not None and len(feature_names) == len(values):
        feature_importances = [
            {"feature": feature_names[i], "value": float(values[i])} for i in range(len(values))
        ]
        feature_importances.sort(key=lambda x: x["value"], reverse=True)

    # Classification Report als Text
    report_text = classification_report(y_test, y_pred)

    return {
        "model_name": model_name,
        "metrics": {
            "accuracy": acc,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "roc_auc": auc,
        },
        "confusion_matrix": {
            "labels": ["Kein Ausfall", "Ausfall"],
            "matrix": cm,
        },
        "classification_report": report_text,
        "roc_curve": {"points": roc_points},
        "feature_importances": feature_importances,
    }
