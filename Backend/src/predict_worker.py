from typing import Dict, Any, Optional

from Backend.src.db_con2 import (
    get_last_pred_ts,
    set_last_pred_ts,
    fetch_new_ai4i_rows_since,
)
from Backend.src.preprocessing import preprocess
from Backend.src.predict import do_prediction, predict_failure_type, stage2_model_name_for

# One-shot Prediction-Step: liest Checkpoint, holt neue DB-Daten, preprocesses, führt Inferenz aus und aktualisiert den Checkpoint
def predict_once(
    model_name: str = "Random_Forest",
    batch_size: int = 50,
    yellow: float = 0.10,
    red: float = 0.75,
    stage1_threshold: float = 0.5,
) -> Dict[str, Any]:
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
    # Wichtig: exakt dieselbe Funktion wie im Training,
    # damit Feature-Definitionen zwischen Training und Inferenz konsistent sind.
    X_pre = preprocess(X_raw)

    # 5) Prediction
    y_pred, y_prob = do_prediction(
        X_pre,
        y_test=None,
        model_name=model_name,
        threshold=stage1_threshold,
    )
    stage2_labels = [None] * len(meta)
    stage2_probs = [None] * len(meta)

    # Simple two-stage gate: stage 2 runs only for hard stage-1 failures.
    stage2_mask = [bool(int(v) == 1) for v in y_pred] 

    run_idx = [i for i, flag in enumerate(stage2_mask) if flag]
    if run_idx:
        x_stage2 = X_pre.iloc[run_idx]
        stage2_model_name = stage2_model_name_for(model_name)
        labels, probs = predict_failure_type(
            x_stage2,
            model_name=stage2_model_name,
        )
        for j, idx in enumerate(run_idx):
            stage2_labels[idx] = str(labels[j])
            stage2_probs[idx] = float(probs[j]) if probs[j] is not None else None

    # 6) Ergebnisse pro Datenpunkt aufbereiten (inkl. Ampelstatus)
    records = []
    for i in range(len(meta)):
        prob_i: Optional[float] = float(y_prob[i]) if y_prob is not None else None

        records.append({
            "UDI": int(meta.iloc[i]["UDI"]),
            "TS": str(meta.iloc[i]["TS"]),
            "predicted_label": int(y_pred[i]),  # backward compatible stage-1 label
            "probability": prob_i,              # backward compatible stage-1 probability
            "stage1_label": int(y_pred[i]),
            "stage1_probability": prob_i,
            "stage1_threshold": float(stage1_threshold),
            "stage2_gate": "stage1_label",
            "stage2_executed": bool(stage2_mask[i]),
            "failure_type_pred": stage2_labels[i],
            "failure_type_prob": stage2_probs[i],
            "failure_mode": stage2_labels[i] if stage2_labels[i] is not None else ("Failure" if int(y_pred[i]) == 1 else "Kein Ausfall"),
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
