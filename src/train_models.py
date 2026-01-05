import os
import pickle
import joblib
import numpy as np
import pandas as pd
from preprocessing import preprocess

from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression, LogisticRegressionCV, SGDClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, AdaBoostClassifier, BaggingClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.neighbors import KNeighborsClassifier
from imblearn.over_sampling import SMOTE
from db_con2 import get_training_data

# 1) Rohdaten laden (statt "df_preprocessing.joblib")
df_raw = get_training_data()  # optional: get_training_data(limit=10000)
#df_raw = pd.read_csv("../data/ai4i2020.csv") Alt aus CSV Datei


# 2) Label abtrennen
y = df_raw["Machine failure"].astype(int)
X_raw = df_raw.drop(columns=["Machine failure"])

# 3) Gemeinsames Preprocessing anwenden
X_pre = preprocess(X_raw)

# 4) Feature-Namen für Serving speichern
feature_names = X_pre.columns.tolist()


# 5) Train/Test Split (stratify sorgt dafür das die Verteilung gleich bleibt)
X_train, X_test, y_train, y_test = train_test_split(X_pre, y, test_size=0.3, random_state=0, stratify=y)

# 6) SMOTE nur auf Trainingsdaten
smote = SMOTE(random_state=42)
X_train_res, y_train_res = smote.fit_resample(X_train, y_train)


# 7) Modelle definieren
models = {
    "Logistic Regression": LogisticRegression(max_iter=500, solver="lbfgs", random_state=0),
    "Logistic Regression CV": LogisticRegressionCV(cv=5, max_iter=500, solver="lbfgs", random_state=0),
    "SGD": SGDClassifier(max_iter=1000, tol=1e-3, random_state=0),
    "Random Forest": RandomForestClassifier(n_estimators=15, max_depth=6, class_weight="balanced", random_state=0),
    "Gradient Boosting": GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=0),
    "AdaBoost": AdaBoostClassifier(n_estimators=50, learning_rate=1.0, random_state=0),
    "Bagging": BaggingClassifier(n_estimators=10, random_state=0),
    "Decision Tree": DecisionTreeClassifier(max_depth=4, random_state=0),
    "K-Nearest Neighbors": KNeighborsClassifier(n_neighbors=5),
}

# 8) Training + Speichern
path = "../data/models"
os.makedirs(path, exist_ok=True)


def create_models(X_train, y_train, feature_names):
    for name, model in models.items():
        model.fit(X_train, y_train)

        filename = os.path.join(path, f"{name.replace(' ', '_')}.pkl")
        with open(filename, "wb") as f:
            pickle.dump(
                {
                    "model": model,
                    "features": feature_names,
                    "preprocess_version": "v1"  # optional, aber nice
                },
                f
            )
        print(f"✅ {name} gespeichert unter {filename}")


# Testset als Artefakt (für Evaluierung)
joblib.dump(X_test, "../data/X_test.joblib")
joblib.dump(y_test, "../data/Y_test.joblib")

#create_models(X_train_res, y_train_res, feature_names)

assert X_pre.isna().sum().sum() == 0, "Preprocessing erzeugt NaNs (z.B. Type mapping)."