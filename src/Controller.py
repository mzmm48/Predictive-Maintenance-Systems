# Controller.py
from fastapi import FastAPI, BackgroundTasks
import joblib
import pandas as pd
from Main2 import simulate_time_stream  # nur noch die Funktion, ohne Side-Effects
from predict import do_prediction
app = FastAPI()

@app.get("/")
def root():
    return {"message": "Hello World"}

@app.get("/predict")
def get_failure_predictions(model_name: str = "Random_Forest"):
    """
    Liefert nur die Test-Samples, bei denen das Modell einen Ausfall (1) vorhersagt.
    """
    # Testdaten laden
    X_test = joblib.load('../data/X_test.joblib')
    y_test = joblib.load('../data/Y_test.joblib')  # kann DataFrame oder Series sein

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

@app.post("/")
def sim(background_tasks: BackgroundTasks,
        delay_seconds: float = 0.01,
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