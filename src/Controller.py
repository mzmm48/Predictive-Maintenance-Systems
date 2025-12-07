#TODO um eine Verbindung mit Swagger zu erstellen müsst ihr in der Konsole/Terminal das eingeben
# 1. cd src
# 2.ls
# 3. uvicorn Controller:app --reload
# Anschließend geht ihr auf den Link in der Konsole  http://127.0.0.1:8000 und dann fügt ihr noch ein /docs hinter
# dem link ein dort könnt ihr dann alle Befehle austesten (GET POST DELETE) welche hier definiert wurden
# Wenn ihr Swagger wieder schließen wollt geht wieder in die Konsole/Terminal und drückt Strg + C
import psycopg2
# Controller.py
from fastapi import FastAPI, BackgroundTasks, Query
import joblib
import pandas as pd
from enum import Enum
from typing import List, Optional

from Main2 import simulate_time_stream, simulate_time_stream_collect, evaluate_model_metrics  # nur noch die Funktion, ohne Side-Effects
from predict import do_prediction
from db_con2 import get_ai4i_data

#Für get_data für das Frontend zur erstellen von Grafiken

app = FastAPI()

class ColumnName(str, Enum):
    torque = "Torque [Nm]"
    rpm = "Rotational speed [rpm]"
    air_temp = "Air temperature [K]"
    proc_temp = "Process temperature [K]"
    tool_wear = "Tool wear [min]"
    machine_failure = "Machine failure"
    #Erweiterbar

class ModelName(str, Enum):
    random_forest = "Random_Forest"
    logistic_regression = "Logistic_Regression"
    logistic_regression_cv = "Logistic_Regression_CV"
    sgd = "SGD"
    gradient_boosting = "Gradient_Boosting"
    adaboost = "AdaBoost"
    bagging = "Bagging"
    decision_tree = "Decision_Tree"
    knn = "K-Nearest_Neighbors"

#TODO die get Methoden dienen aller erstens für das Verständnis der API die einzige die nicht dazu zählt ist
# "getdata"

@app.get("/")
def root():
    return {"message": "Hello World"}

#Ausführen der Predict Method. Gibt alle were weiter die Failure = 1 sind
@app.get("/predict")
def get_failure_predictions(model_name: str = "Random_Forest"):
    """
    Liefert nur die Test-Samples, bei denen das Modell einen Ausfall (1) vorhersagt.
    """
    # Testdaten laden
    X_test = joblib.load('../data/X_test.joblib')
    y_test = joblib.load('../data/Y_test.joblib')  # kann DataFrame oder Series seinD

    # y_test in eine 1D-Form bringen
    if isinstance(y_test, pd.DataFrame):
        y_series = y_test.iloc[:, 0]
    else:
        y_series = y_test

    # Modellvorhersage für das komplette Test-Set
    y_pred, y_prob = do_prediction(X_test, y_series, model_name=model_name)

    # Wenn y_prob None ist (Modell ohne Probabilities), etwas defensiv behandeln
    if y_prob is None:
        y_prob_list = [None] * len(y_pred)
    else:
        y_prob_list = y_prob.tolist()

    # Nur Fälle mit vorhergesagtem Ausfall (y_pred == 1) sammeln
    failures = []
    for idx, (true_label, pred_label, prob) in enumerate(zip(y_series, y_pred, y_prob_list)):
        if int(pred_label) == 1:
            failures.append({
                "index": int(idx),
                "true_label": int(true_label),
                "predicted_label": int(pred_label),
                "probability_failure": float(prob) if prob is not None else None
            })

    return {
        "model_name": model_name,
        "total_samples": len(y_series),
        "failure_predictions_count": len(failures),
        "failure_predictions": failures
    }

#Ausführen von def simulate_time_stream
@app.post("/sim")
def sim(background_tasks: BackgroundTasks,
        delay_seconds: float = 0.50,
        model_name: str = "Random_Forest"):

    x_test = joblib.load('../data/X_test.joblib')
    y_test = joblib.load('../data/Y_test.joblib')

    x_test2 = x_test.reset_index(drop=True)
    y_test2 = y_test.reset_index(drop=True)

    # Simulation im Hintergrund starten
    background_tasks.add_task(
        simulate_time_stream,
        x_test2,
        y_test2,
        delay_seconds,
        model_name
    )

    return {
        "status": "simulation started",
        "n_samples": len(x_test2),
        "delay_seconds": delay_seconds,
        "model_name": model_name
    }


#Frontend bekommt angefragte Daten aus der DB (Gleichzeitige auswahl von mehreren Spalten möglich bsp. Torque und RPM)
#TODO Wichtig behalten
@app.get("/getdata")
def get_data(limit: int = 10, columns: Optional[List[ColumnName]] = Query(None)):

    df = get_ai4i_data(limit=limit)

    if columns:
        col_names = [c.value for c in columns]  # Enum -> echter Spaltenname
        df = df[col_names]

    records = df.to_dict(orient="records")

    return {
        "row_count": len(records),
        "data": records
        }

#Lässt das Frontend auf Auswertungskriterien des Vorhersagemodells zugreifen
@app.get("/evaluate_model")
def evaluate_model(model_name: ModelName = ModelName.random_forest):

    result = evaluate_model_metrics(model_name.value)
    return result
#Zeigt auf Swagger die vorhersagen für x an
@app.get("/sim_preview")
def sim_preview(limit: int = 10, model_name: str = "Random_Forest"):
    """
    Simuliert die ersten 'limit' Testdaten synchron und gibt alle
    einzelnen Predictions als JSON zurück.
    Perfekt zum Anschauen in Swagger.
    """
    x_test = joblib.load('../data/X_test.joblib')
    y_test = joblib.load('../data/Y_test.joblib')

    x_test2 = x_test.reset_index(drop=True)
    y_test2 = y_test.reset_index(drop=True)

    results = simulate_time_stream_collect(
        x_test2,
        y_test2,
        model_name=model_name,
        limit=limit,
    )

    return {
        "model_name": model_name,
        "sample_count": len(results),
        "results": results
    }