import threading
import time
from typing import Optional, Dict, Any
from datetime import timedelta
import pandas as pd

from db_con2 import get_max_ts_ai4i, insert_ai4i_row, delete_ai4i_rows_since


class SimulationService:
    """
    Simuliert Sensordaten-Streaming, indem Zeilen aus einer CSV in die DB eingefügt werden.

    Ziele:
    - TS ist streng monoton steigend (wichtig für Predict-Checkpoint-Logik: TS > last_pred_ts)
    - optional: UDI eindeutig machen (falls DB UNIQUE/PRIMARY KEY auf UDI hat)
    - Reset löscht alle Simulationsdaten (TS >= sim_start_ts)
    """

    def __init__(
        self,
        source_path: str = "../data/ai4i2020_sim.csv",
        udi_mode: str = "keep",          # "keep" | "offset" | "tick"
        udi_offset: int = 10_000_000,    # nur relevant bei udi_mode="offset"
    ):
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        self._interval: float = 1.0
        self._running: bool = False

        self._df_source = pd.read_csv(source_path)
        if self._df_source.empty:
            raise ValueError(f"Simulation CSV ist leer: {source_path}")

        # CSV-Index (darf loopen)
        self._idx = 0

        # TS-Tick (darf NICHT loopen -> TS immer weiter)
        self._tick = 0

        # wird beim Start gesetzt
        self._sim_start_ts = None  # ab hier löschen wir beim reset
        self._base_ts = None       # max_ts + 1s

        # UDI Verhalten
        self._udi_mode = udi_mode
        self._udi_offset = udi_offset

        # Für Status/Debug
        self._inserted_rows = 0
        self._last_insert_ts = None

    def _prepare_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Setzt TS (monoton) und optional UDI eindeutig."""
        # TS strikt monoton: base_ts + tick * interval
        ts = self._base_ts + timedelta(seconds=self._tick * self._interval)
        row["TS"] = ts

        # UDI optional eindeutig machen
        # - keep: unverändert
        # - offset: UDI + udi_offset (stabil, aber kann trotzdem kollidieren, wenn CSV mehrfach läuft)
        # - tick:  udi_offset + tick (immer eindeutig)
        if self._udi_mode == "offset":
            # Vorsicht: wenn CSV wiederholt wird, ist UDI wieder identisch -> evtl. trotzdem Kollision.
            # Nur ok, wenn UDI in DB NICHT unique ist ODER du nach reset immer löschst.
            try:
                row["UDI"] = int(row.get("UDI", 0)) + int(self._udi_offset)
            except Exception:
                row["UDI"] = int(self._udi_offset)
        elif self._udi_mode == "tick":
            # Immer eindeutig, auch über CSV-Loop hinaus
            row["UDI"] = int(self._udi_offset) + int(self._tick)

        return row

    def _run(self):
        self._running = True
        try:
            while not self._stop_event.is_set():
                # 1) Quelle lesen
                row = self._df_source.iloc[self._idx].to_dict()

                # 2) TS & ggf. UDI setzen
                row = self._prepare_row(row)

                # 3) Insert
                insert_ai4i_row(row)

                # 4) State updaten
                self._last_insert_ts = row["TS"]
                self._inserted_rows += 1

                # 5) Indizes weiterschalten
                self._idx = (self._idx + 1) % len(self._df_source)  # CSV darf loopen
                self._tick += 1                                    # TS darf NICHT loopen

                # 6) Warten
                time.sleep(self._interval)
        finally:
            self._running = False

    def start(self, interval: float = 1.0) -> Dict[str, Any]:
        """Startet die Simulation (wenn nicht schon aktiv)."""
        if self._thread is not None and self._thread.is_alive():
            return {"started": False, "message": "simulation already running", "status": self.status()}

        self._interval = float(interval)
        if self._interval <= 0:
            raise ValueError("interval muss > 0 sein")

        self._stop_event.clear()

        # Simulation soll nur "neue" Daten erzeugen -> starte nach aktuellem MAX(TS)
        max_ts = get_max_ts_ai4i()
        self._base_ts = max_ts + timedelta(seconds=1)
        self._sim_start_ts = self._base_ts

        # Zähler zurücksetzen
        self._idx = 0
        self._tick = 0
        self._inserted_rows = 0
        self._last_insert_ts = None

        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

        return {
            "started": True,
            "interval": self._interval,
            "sim_start_ts": str(self._sim_start_ts),
            "base_ts": str(self._base_ts),
            "source_rows": len(self._df_source),
            "udi_mode": self._udi_mode,
            "udi_offset": self._udi_offset,
        }

    def stop(self) -> Dict[str, Any]:
        """Stoppt die Simulation (Thread endet beim nächsten Loop)."""
        self._stop_event.set()
        return {"stopped": True, "status": self.status()}

    def reset(self) -> Dict[str, Any]:
        """
        Stoppt und löscht alle Simulationsdaten (TS >= sim_start_ts).
        """
        self.stop()

        if self._sim_start_ts is None:
            return {"reset": False, "message": "simulation was never started, nothing to delete"}

        deleted = delete_ai4i_rows_since(self._sim_start_ts)

        # Zustand zurücksetzen
        old_start = self._sim_start_ts
        self._sim_start_ts = None
        self._base_ts = None
        self._idx = 0
        self._tick = 0
        self._inserted_rows = 0
        self._last_insert_ts = None

        return {"reset": True, "deleted_rows": deleted, "deleted_since": str(old_start)}

    def status(self) -> Dict[str, Any]:
        return {
            "running": self._running,
            "interval": self._interval,
            "csv_idx": self._idx,
            "tick": self._tick,
            "inserted_rows": self._inserted_rows,
            "last_insert_ts": str(self._last_insert_ts) if self._last_insert_ts else None,
            "sim_start_ts": str(self._sim_start_ts) if self._sim_start_ts else None,
            "source_rows": len(self._df_source),
            "udi_mode": self._udi_mode,
            "udi_offset": self._udi_offset,
        }