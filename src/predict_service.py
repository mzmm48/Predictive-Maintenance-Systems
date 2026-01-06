import threading
import time
from typing import Optional, Dict, Any

from predict_worker import predict_once


class PredictionService:
    def __init__(self):
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        self._interval: float = 1.0
        self._model_name: str = "Random_Forest"
        self._batch_size: int = 50

        self._last_result: Optional[Dict[str, Any]] = None
        self._running: bool = False

    def _run(self):
        self._running = True
        try:
            while not self._stop_event.is_set():
                self._last_result = predict_once(
                    model_name=self._model_name,
                    batch_size=self._batch_size
                )
                time.sleep(self._interval)
        finally:
            self._running = False

    def start(self, interval: float = 1.0, model_name: str = "Random_Forest", batch_size: int = 50) -> bool:
        # läuft schon?
        if self._thread is not None and self._thread.is_alive():
            return False

        self._interval = interval
        self._model_name = model_name
        self._batch_size = batch_size

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        return True

    def stop(self) -> bool:
        self._stop_event.set()
        return True

    def status(self) -> Dict[str, Any]:
        return {
            "running": self._running,
            "interval": self._interval,
            "model_name": self._model_name,
            "batch_size": self._batch_size,
            "last_result": self._last_result,
        }