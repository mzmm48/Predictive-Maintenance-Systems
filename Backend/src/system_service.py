from fastapi import HTTPException
from typing import Tuple, Dict, Any

from Backend.src.db_con2 import reset_checkpoint_replay, reset_last_pred_ts_to_db_max

# System-Reset-Helper: stoppt Prediction/Simulation, löscht optional Simulationsdaten und setzt den Checkpoint je nach Modus
def reset_all_internal(
    *,
    prediction_service,
    simulation_service,
    mode: str,
    delete_sim_data: bool
) -> Tuple[Dict[str, Any], Dict[str, Any]]:

    # 1) Prediction stoppen
    prediction_service.stop()

    # 2) Simulation stoppen
    simulation_service.stop()

    # 3) Optional Simulationsdaten löschen
    sim_reset_result = None
    if delete_sim_data:
        sim_reset_result = simulation_service.reset()

    # 4) Checkpoint setzen
    if mode == "simulation":
        checkpoint = reset_last_pred_ts_to_db_max()
        checkpoint_info = {
            "mode": "simulation",
            "checkpoint_set_to": str(checkpoint)
        }
    elif mode == "replay":
        reset_checkpoint_replay()
        checkpoint_info = {
            "mode": "replay",
            "checkpoint_set_to": "1970-01-01T00:00:00Z"
        }
    else:
        raise HTTPException(
            status_code=400,
            detail="mode must be 'simulation' or 'replay'"
        )

    return sim_reset_result, checkpoint_info