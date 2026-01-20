import pickle
import joblib
import numpy as np

from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, precision_recall_fscore_support, roc_auc_score

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

    # Probabilities (falls vorhanden)
    y_prob = None
    if hasattr(model, "predict_proba"):
        y_prob = model.predict_proba(X_test)[:, 1]
    elif hasattr(model, "decision_function"):
        scores = model.decision_function(X_test)
        y_prob = 1 / (1 + np.exp(-scores))

    # Grundlegende Kennzahlen
    acc = accuracy_score(y_test, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_test, y_pred, average="binary", zero_division=0
    )

    # Confusion Matrix
    cm = confusion_matrix(y_test, y_pred).tolist()  # als Liste für JSON

    # ROC-AUC falls Probabilities da
    auc = None
    if y_prob is not None:
        try:
            auc = roc_auc_score(y_test, y_prob)
        except ValueError:
            auc = None

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
    }