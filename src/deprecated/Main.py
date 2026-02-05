#TODO Hauptanwendung
import pickle
import joblib
import time
from datetime import datetime
from zoneinfo import ZoneInfo
import numpy as np
from matplotlib import pyplot as plt
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, precision_recall_fscore_support, roc_auc_score

from predict import do_prediction

berlin_tz = ZoneInfo("Europe/Berlin")

x_test = joblib.load('../../data/X_test.joblib')
y_test = joblib.load('../../data/Y_test.joblib')

x_test2 = x_test.reset_index(drop=True)
y_test2 = y_test.reset_index(drop=True)

#Simuliert Zeitreihe
def simulate_time_stream(x_test2, y_test2, delay_seconds=0.01, model_name: str = 'Random_Forest'):

    for i in range(len(x_test2)):
        n = i
        x_test = x_test2.iloc[[i]]
        y_test = y_test2.iloc[i]

        print("Index")
        print(n)
        now = datetime.now(berlin_tz)
        print(f"[{now:%Y-%m-%d %H:%M:%S}]")

        do_prediction(x_test, y_test, model_name= model_name)

        time.sleep(delay_seconds)


def simulate_time_stream_collect(x_test2, y_test2, model_name: str = 'Random_Forest', limit: int | None = None):
    """
    Wie simulate_time_stream, aber:
    - KEIN sleep
    - sammelt alle Predictions in einer Liste und gibt sie zurück.
    - keine simulation von echt zeiten
    """
    results = []

    n_samples = len(x_test2)
    if limit is not None:
        n_samples = min(n_samples, limit)

    for i in range(n_samples):
        x_row = x_test2.iloc[[i]]
        y_true = int(y_test2.iloc[i])

        now = datetime.now(berlin_tz)

        y_pred, y_prob = do_prediction(x_row, y_true, model_name=model_name)

        # y_pred und y_prob sind Arrays -> in Python-Typen umwandeln
        pred_int = int(y_pred[0])
        prob_float = float(y_prob[0]) if y_prob is not None else None

        results.append({
            "index": i,
            "timestamp": now.isoformat(),
            "y_true": y_true,
            "y_pred": pred_int,
            "probability_failure": prob_float
        })

    return results

if __name__ == "__main__":
    evaluate_model(x_test, y_test, "Random_Forest")
    simulate_time_stream(x_test, y_test)