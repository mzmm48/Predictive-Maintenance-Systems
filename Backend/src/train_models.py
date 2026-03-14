import json
import pickle
from pathlib import Path

import joblib
from imblearn.over_sampling import SMOTE
from sklearn.ensemble import AdaBoostClassifier, BaggingClassifier, GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression, LogisticRegressionCV, SGDClassifier
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.tree import DecisionTreeClassifier

from Backend.src.db_con2 import get_training_data
from Backend.src.failure_type import attach_failure_type, filter_stage2_training_rows
from Backend.src.preprocessing import preprocess

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = DATA_DIR / "models"


def _model_registry() -> dict[str, object]:
    # Modellkatalog für beide Stufen:
    # Stage 1 nutzt den Namen direkt (z. B. Random_Forest.pkl),
    # Stage 2 nutzt denselben Modelltyp mit Suffix (_FailureType.pkl).
    return {
        "Logistic_Regression": LogisticRegression(max_iter=500, solver="lbfgs", random_state=0),
        "Logistic_Regression_CV": LogisticRegressionCV(cv=5, max_iter=500, solver="lbfgs", random_state=0),
        "SGD": SGDClassifier(max_iter=1000, tol=1e-3, random_state=0),
        "Random_Forest": RandomForestClassifier(n_estimators=15, max_depth=6, class_weight="balanced", random_state=0),
        "Gradient_Boosting": GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=0),
        "AdaBoost": AdaBoostClassifier(n_estimators=50, learning_rate=1.0, random_state=0),
        "Bagging": BaggingClassifier(n_estimators=10, random_state=0),
        "Decision_Tree": DecisionTreeClassifier(max_depth=4, random_state=0),
        "K-Nearest_Neighbors": KNeighborsClassifier(n_neighbors=5),
    }


def _save_model(filename: Path, model, feature_names: list[str], extra: dict | None = None) -> None:
    # Einheitliches Artefaktformat:
    # - trainiertes Modell
    # - erwartete Feature-Reihenfolge für Inferenz
    # - optionale Metadaten (z. B. Klassen bei Stage 2)
    # payload bedeutet hier die Datenstruktur, die in der Pickle-Datei gespeichert wird. Sie enthält das Modell, die Feature-Namen und optionale zusätzliche Informationen.
    payload = {
        "model": model,
        "features": feature_names,
        "preprocess_version": "v2",
    }
     # extra Metadaten werden in die payload integriert, z. B. Modelltyp oder Klasseninformationen für Stage 2.
     # (model_type zeigt ob es sich um ein Stage-1- oder Stage-2-Modell handelt, classes enthält die Klassenlabels für Stage 2, base_model_name verweist auf den zugrunde liegenden Modelltyp ohne Stufen-Suffix.)
    if extra:
        payload.update(extra)
    with open(filename, "wb") as f:
        pickle.dump(payload, f)


def train_all_models() -> dict:
    # Ziel: beide Stufen trainieren und alle benötigten Artefakte speichern.
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # 1) Load + enrich labels
    # Rohdaten aus DB lesen und aus TWF/HDF/PWF/OSF/RNF eine single-label failure_type erzeugen.
    df_raw = get_training_data()
    df_raw = attach_failure_type(df_raw)

    # 2) Global split (single split for stage 1 and stage 2)
    # Ein gemeinsamer Split verhindert Daten-Leakage zwischen Stage 1 und Stage 2.
    df_train, df_test = train_test_split(
        df_raw,
        test_size=0.3,
        random_state=0,
        stratify=df_raw["Machine failure"].astype(int),
    )

    # 3) Stage-1 dataset
    # Stage 1: Binärziel "Machine failure".
    y_stage1_train = df_train["Machine failure"].astype(int)
    y_stage1_test = df_test["Machine failure"].astype(int)
    # Hier wird das zentrale Preprocessing angewendet:
    # - Spalten bereinigen
    # - neue Features erzeugen
    # - Type codieren
    x_stage1_train = preprocess(df_train.drop(columns=["Machine failure", "failure_type"]))
    x_stage1_test = preprocess(df_test.drop(columns=["Machine failure", "failure_type"]))
    feature_names = x_stage1_train.columns.tolist()

    # Keep original behavior: SMOTE on stage-1 training only.
    # SMOTE nur auf Trainingsdaten (nicht auf Testdaten), um Klassenungleichgewicht zu reduzieren.
    smote_stage1 = SMOTE(random_state=42)
    x_stage1_train_res, y_stage1_train_res = smote_stage1.fit_resample(x_stage1_train, y_stage1_train)

    # Evaluation artifacts for stage 1
    # Test-Artefakte für /evaluate_model-Endpunkt.
    joblib.dump(x_stage1_test, DATA_DIR / "X_test.joblib")
    joblib.dump(y_stage1_test, DATA_DIR / "Y_test.joblib")

    # 4) Stage-2 dataset: positive failures with single valid label
    # Stage 2 trainiert nur auf echten Ausfällen mit eindeutiger Fehlerart.
    df_train_s2 = filter_stage2_training_rows(df_train)
    df_test_s2 = filter_stage2_training_rows(df_test)

    # Dasselbe Preprocessing wird auch für Stage 2 verwendet,
    # damit beide Stufen auf identischer Featurelogik basieren.
    x_stage2_train = preprocess(df_train_s2.drop(columns=["Machine failure", "failure_type"]))
    x_stage2_test = preprocess(df_test_s2.drop(columns=["Machine failure", "failure_type"]))

    label_encoder = LabelEncoder()
    # Fehlerart-Strings (TWF/HDF/...) in numerische Klassen umwandeln.
    y_stage2_train = label_encoder.fit_transform(df_train_s2["failure_type"].astype(str))
    y_stage2_test = label_encoder.transform(df_test_s2["failure_type"].astype(str))

    # Optional balancing for stage 2 as well (same strategy style as stage 1).
    # Auch Stage 2 wird per SMOTE auf Trainingsdaten ausgeglichen.
    smote_stage2 = SMOTE(random_state=42)
    x_stage2_train_res, y_stage2_train_res = smote_stage2.fit_resample(x_stage2_train, y_stage2_train)

    # Evaluation artifacts for stage 2
    # Artefakte für /evaluate_failure_type-Endpunkt und Debugging.
    joblib.dump(x_stage2_test, DATA_DIR / "X_test_stage2.joblib")
    joblib.dump(y_stage2_test, DATA_DIR / "Y_test_stage2.joblib")
    joblib.dump(label_encoder.classes_.tolist(), DATA_DIR / "Y_stage2_classes.joblib")
    joblib.dump(label_encoder, MODELS_DIR / "Failure_Type_LabelEncoder.joblib")

    # 5) Train both stages with the same model family registry
    # Für jeden Modellnamen werden zwei getrennte Modelle trainiert:
    # - Stage 1: <ModelName>.pkl
    # - Stage 2: <ModelName>_FailureType.pkl
    registry = _model_registry()
    for model_name, stage1_model in registry.items():
        # Stage 1
        stage1_model.fit(x_stage1_train_res, y_stage1_train_res)
        _save_model(
            MODELS_DIR / f"{model_name}.pkl",
            model=stage1_model,
            feature_names=feature_names,
            extra={"model_type": "stage1_binary"},
        )

        # Stage 2 (same model type, separate model instance and artifact)
        # Neue Instanz pro Stufe, damit kein Zustand zwischen Stufen geteilt wird.
        stage2_model = _model_registry()[model_name]
        stage2_model.fit(x_stage2_train_res, y_stage2_train_res)
        _save_model(
            MODELS_DIR / f"{model_name}_FailureType.pkl",
            model=stage2_model,
            feature_names=x_stage2_train.columns.tolist(),
            extra={
                "model_type": "stage2_multiclass",
                "classes": label_encoder.classes_.tolist(),
                "base_model_name": model_name,
            },
        )

    summary = {
        # Kompakte Trainingszusammenfassung für Nachvollziehbarkeit.
        "rows_total": int(len(df_raw)),
        "rows_train": int(len(df_train)),
        "rows_test": int(len(df_test)),
        "stage2_rows_train": int(len(df_train_s2)),
        "stage2_rows_test": int(len(df_test_s2)),
        "stage2_classes": label_encoder.classes_.tolist(),
        "stage2_models": [f"{name}_FailureType" for name in registry.keys()],
        "stage2_gate_rule": "stage1_label == 1",
    }
    with open(MODELS_DIR / "training_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    return summary


if __name__ == "__main__":
    result = train_all_models()
    print("Training completed:")
    print(json.dumps(result, indent=2))
