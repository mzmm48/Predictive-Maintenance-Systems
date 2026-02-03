from typing import Dict, Any, Optional
import pandas as pd

from db_con2 import get_last_pred_ts, set_last_pred_ts, fetch_new_ai4i_rows_since
from preprocessing import preprocess
from predict import do_prediction

# One-shot Prediction-Step: liest Checkpoint, holt neue DB-Daten, preprocesses, führt Inferenz aus und aktualisiert den Checkpoint
def predict_once(model_name: str = "Random_Forest", batch_size: int = 50, yellow: float = 0.10, red: float = 0.75) -> Dict[str, Any]:
    # 1) Checkpoint lesen
    last_ts = get_last_pred_ts()

    # 2) Neue Daten holen
    df_new = fetch_new_ai4i_rows_since(last_ts, limit=batch_size)
    if df_new.empty:
        return {
            "processed": 0,
            "message": "no new data",
            "last_pred_ts": str(last_ts),
            "failures": []
        }

    # 3) Features vorbereiten (UID/TS sind Metadaten)
    meta = df_new[["UDI", "TS"]].copy()
    X_raw = df_new.drop(columns=["UDI", "TS"])

    # 4) Preprocessing
    X_pre = preprocess(X_raw)

    # 5) Prediction
    y_pred, y_prob = do_prediction(X_pre, y_test=None, model_name=model_name)

    # 6) Ergebnisse pro Datenpunkt aufbereiten (inkl. Ampelstatus)
    records = []
    for i in range(len(meta)):
        prob_i: Optional[float] = float(y_prob[i]) if y_prob is not None else None

        records.append({
            "UDI": int(meta.iloc[i]["UDI"]),
            "TS": str(meta.iloc[i]["TS"]),
            "predicted_label": int(y_pred[i]),
            "probability": prob_i,
            "traffic_light": traffic_light(prob_i, yellow=yellow, red=red)
        })

    # 7) Checkpoint aktualisieren (größter TS-Wert des verarbeiteten Batches)
    new_last_ts = df_new["TS"].max()
    set_last_pred_ts(new_last_ts)

    # 8) Kompakte Zusammenfassung für Frontend / Dashboard
    summary = {
        "green": sum(r["traffic_light"] == "green" for r in records),
        "yellow": sum(r["traffic_light"] == "yellow" for r in records),
        "red": sum(r["traffic_light"] == "red" for r in records),
    }

    return {
        "processed": len(records),
        "last_pred_ts_old": str(last_ts),
        "last_pred_ts_new": str(new_last_ts),
        "records": records,
        "summary": summary
    }

#Ampelsystem für Wahrscheinlichkeiten anhand von Schwellwerten
def traffic_light(prob: float, yellow: float = 0.10, red: float = 0.75) -> str:
    """
    Leitet aus der Ausfallwahrscheinlichkeiten einen Ampelstatus ab
    """
    if prob is None:
        return "unknown"
    if prob >= red:
        return "red"
    if prob >= yellow:
        return "yellow"
    return "green"