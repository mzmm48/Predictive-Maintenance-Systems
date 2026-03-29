# Controller.py – FastAPI Backend für Predictive Maintenance (Demo/Testbetrieb)

# Swagger starten (lokal):
# Terminal öffnen
# Optional: ..\ .venv\Scripts\activate
# python -m uvicorn Backend.src.Controller:app --reload
# Anschließend geht auf den Link in der Konsole http://127.0.0.1:8000 und dann fügt ihr noch ein /docs dran
# API stoppen:
# - Terminal fokussieren und Strg + C drücken.

# IMPORTS
from fastapi import FastAPI, Query, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
import joblib                                           # Debug : Laden von lokalen Artefakten (X_test.joblib / y_test.joblib)
import pandas as pd                                     # Debug: y_test Handling, DataFrame-Checks
from enum import Enum
from typing import List, Optional

from Backend.src.predict_worker import predict_once                 # One-shot Pipeline Step (DB -> preprocess -> predict)
from Backend.src.predict_service import PredictionService           # Hintergrundservice: ruft predict_once im Intervall auf
from Backend.src.evaluation_service import evaluate_model_metrics, evaluate_failure_type_metrics   # Debug Evaluation-Endpunkt (z. B. Accuracy, Recall, etc.)
from Backend.src.predict import do_prediction                       # Model-Inferenz (inkl. predict_proba fallback)
from Backend.src.db_con2 import get_ai4i_data                       # DB-Zugriff (Frontend-Daten + Auth-Query)
from Backend.src.simulate_service import SimulationService          # Simulation: schreibt neue Datensätze in DB
from Backend.src.system_service import reset_all_internal           # System-Reset: stoppt Services, setzt Checkpoints, etc.

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]   # .../backend
DATA_DIR = BASE_DIR / "data"

from dotenv import load_dotenv

#Für get_data für das Frontend zur erstellen von Grafiken
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
import os
import secrets
import psycopg2

from Backend.src.db_con2 import read_dataframe

#zu sicherstellung der env
load_dotenv( BASE_DIR / ".env" )

# APP / SERVICES SETUP/ Schemas
app = FastAPI()
service = PredictionService()
# Simulation-Service: schreibt aus CSV schrittweise neue Zeilen in die ai4i2020v2 Tabelle
sim_service = SimulationService(
    source_path=str(DATA_DIR / "ai4i2020_sim.csv"),
    udi_mode="tick",
    udi_offset=10_000_000
)

# CORS: erlaubt Zugriff vom Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Damit Frontend bei DB-/Config-Fehlern keinen "CORS/Network Error" bekommt,
# sondern eine saubere JSON-Antwort inkl. CORS-Header.
@app.exception_handler(psycopg2.Error)
async def _handle_psycopg2_error(_: Request, exc: psycopg2.Error):
    return JSONResponse(status_code=503, content={"detail": f"Database error: {exc.__class__.__name__}"})

@app.exception_handler(RuntimeError)
async def _handle_runtime_error(_: Request, exc: RuntimeError):
    return JSONResponse(status_code=500, content={"detail": str(exc)})

# Enum: Erlaubte Spaltennamen
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


# Auth (JWT in HttpOnly Cookie) - nutzt Tabelle "anmeldung"
PMS_ENV = os.getenv("PMS_ENV", "dev")
_jwt_secret_env = os.getenv("PMS_JWT_SECRET")
JWT_SECRET = _jwt_secret_env or "dev-secret-change-me"
JWT_ALG = "HS256"
COOKIE_NAME = "pms_access_token"
TOKEN_TTL_MINUTES = 8 * 60  # 8 Stunden

# Enforce secret in non-dev environments
if PMS_ENV != "dev" and (not _jwt_secret_env or _jwt_secret_env == "dev-secret-change-me"):
    raise RuntimeError(
        "PMS_JWT_SECRET must be set to a strong value when PMS_ENV is not 'dev'."
    )

def _env_bool(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "y", "on"}

COOKIE_SECURE = _env_bool("PMS_COOKIE_SECURE", default=False)
COOKIE_SAMESITE = os.getenv("PMS_COOKIE_SAMESITE", "lax")
try:
    COOKIE_MAX_AGE_SECONDS = int(
        os.getenv("PMS_COOKIE_MAX_AGE_SECONDS", str(TOKEN_TTL_MINUTES * 60))
    )
except ValueError:
    COOKIE_MAX_AGE_SECONDS = TOKEN_TTL_MINUTES * 60

CSRF_COOKIE_NAME = "pms_csrf"
CSRF_HEADER_NAME = "X-CSRF-Token"
SWAGGER_CSRF_BYPASS = _env_bool(
    "PMS_SWAGGER_CSRF_BYPASS",
    default=PMS_ENV in {"dev", "local"},
)

def _is_swagger_ui_request(request: Request) -> bool:
    referer = request.headers.get("referer")
    if not referer:
        return False
    try:
        ref_path = urlparse(referer).path or ""
    except Exception:
        return False
    return ref_path.startswith("/docs") or ref_path.startswith("/redoc")

def _set_csrf_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token,
        httponly=False,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=COOKIE_MAX_AGE_SECONDS,
        path="/",
    )

@app.middleware("http")
async def csrf_double_submit(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        path = request.url.path
        if path not in {"/auth/login", "/auth/logout"}:
            if SWAGGER_CSRF_BYPASS and _is_swagger_ui_request(request):
                return await call_next(request)
            cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
            header_token = request.headers.get(CSRF_HEADER_NAME)
            if not cookie_token or not header_token or cookie_token != header_token:
                return JSONResponse(status_code=403, content={"detail": "CSRF validation failed"})
    return await call_next(request)

class LoginRequest(BaseModel):
    username: str
    password: str

def create_access_token(username: str, role: str):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=TOKEN_TTL_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def read_user_from_cookie(request: Request):
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return {"username": payload.get("sub"), "role": payload.get("role")}
    except JWTError:
        return None

#Auth-Guards (damit Endpoints NICHT ohne Login aufrufbar sind)
def require_user(request: Request):
    user = read_user_from_cookie(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

def require_admin(user=Depends(require_user)):
    if str(user.get("role", "")).lower() != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return user


@app.post("/auth/login")
def auth_login(req: LoginRequest, response: Response):
    # Achtung: Spaltennamen sind case-sensitive und enthalten Bindestrich -> immer "..."
    df = read_dataframe(
        'SELECT "Username","Vorname","Nachname","Passwort","E-Mail","Rolle" '
        'FROM public.anmeldung WHERE "Username" = %s LIMIT 1;',
        (req.username,)
    )

    if df.empty:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    row = df.iloc[0].to_dict()

    # Passwort ist bei euch Klartext in der DB -> Klartextvergleich
    # Passwort ist bei euch Klartext in der DB -> Klartextvergleich
    if req.password != str(row.get("Passwort", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    role = str(row.get("Rolle", "user"))
    token = create_access_token(req.username, role)

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,     # lokal ok; prod: True + HTTPS
        samesite=COOKIE_SAMESITE,
        max_age=COOKIE_MAX_AGE_SECONDS,
        path="/",
    )
    csrf_token = secrets.token_urlsafe(32)
    _set_csrf_cookie(response, csrf_token)

    return {
        "ok": True,
        "username": req.username,
        "role": role,
        "vorname": row.get("Vorname"),
        "nachname": row.get("Nachname"),
        "email": row.get("E-Mail"),
    }

@app.get("/auth/me")
def auth_me(request: Request, response: Response):
    user = read_user_from_cookie(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not request.cookies.get(CSRF_COOKIE_NAME):
        _set_csrf_cookie(response, secrets.token_urlsafe(32))
    return {"ok": True, **user}

@app.post("/auth/logout")
def auth_logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    response.delete_cookie(key=CSRF_COOKIE_NAME, path="/")
    return {"ok": True}

# Debug / DEV

# Root: einfacher Endpoint um zu prüfen ob API läuft
@app.get("/")
def root():
    #Health-Check
    return {"message": "Hello World"}


# DEBUG: Offline-Test mit gespeichertem Testset (nicht DB-basiert)
@app.get("/predict_testset_failures")
def get_failure_predictions(model_name: str = "Random_Forest", user=Depends(require_user)):
    try:
        # 1) Artefakte laden
        try:
            X_test = joblib.load(DATA_DIR / "X_test.joblib")
            y_test = joblib.load(DATA_DIR / "Y_test.joblib")
        except FileNotFoundError as e:
            raise HTTPException(
                status_code=404,
                detail=f"Testset-Artefakte nicht gefunden: {e}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Fehler beim Laden der Testset-Artefakte: {e}"
            )

        # 2) y in 1D bringen
        if isinstance(y_test, pd.DataFrame):
            if y_test.shape[1] < 1:
                raise HTTPException(status_code=500, detail="y_test DataFrame hat keine Spalten.")
            y_series = y_test.iloc[:, 0]
        else:
            y_series = y_test

        # 3) Prediction
        try:
            y_pred, y_prob = do_prediction(X_test, y_series, model_name=model_name)
        except FileNotFoundError:
            raise HTTPException(
                status_code=404,
                detail=f"Modell-Datei für '{model_name}' nicht gefunden."
            )
        except ValueError as e:
            # z.B. fehlende Features / falsches Format
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Prediction fehlgeschlagen: {e}")

        # 4) Probabilities defensiv
        y_prob_list = [None] * len(y_pred) if y_prob is None else y_prob.tolist()

        # 5) Failures filtern
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

    except HTTPException:
        raise
    except Exception as e:
        # Fallback
        raise HTTPException(status_code=500, detail=str(e))



# Daten-Endpoint: liefert Datensätze aus DB
@app.get("/getdata")
def get_data(limit: int = 10, columns: Optional[List[ColumnName]] = Query(None), user=Depends(require_user)):
    try:
        # 1) Input validieren
        if limit <= 0:
            raise HTTPException(status_code=400, detail="limit muss > 0 sein.")
        if limit > 10_000:
            raise HTTPException(status_code=400, detail="limit ist zu groß (max 10000).")

        # 2) DB lesen
        try:
            df = get_ai4i_data(limit=limit)
        except Exception as e:
            # DB down / falsche Tabelle / SQL Fehler
            raise HTTPException(status_code=503, detail=f"Datenbankfehler beim Laden der Daten: {e}")

        if df is None or df.empty:
            # Kein Fehler, aber sauber kommunizieren
            return {"row_count": 0, "data": []}

        # 3) Spalten filtern
        if columns:
            col_names = [c.value for c in columns]
            missing = [c for c in col_names if c not in df.columns]
            if missing:
                raise HTTPException(status_code=400, detail=f"Ungültige Spalten angefragt: {missing}")
            df = df[col_names]

        return {
            "row_count": int(len(df)),
            "data": df.to_dict(orient="records")
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# Prediction (One-shot): führt einen einzelnen Pipeline-Durchlauf
@app.post("/predict/once")
def api_predict_once(
    model_name: str = "Random_Forest",
    batch_size: int = 50,
    stage1_threshold: float = 0.5,
    user=Depends(require_user),
):
    try:
        # 1) Input validieren
        if batch_size <= 0:
            raise HTTPException(status_code=400, detail="batch_size muss > 0 sein.")
        if batch_size > 10_000:
            raise HTTPException(status_code=400, detail="batch_size ist zu groß (max 10000).")

        # 2) Predict Step ausführen
        try:
            result = predict_once(
                model_name=model_name,
                batch_size=batch_size,
                stage1_threshold=stage1_threshold,
            )
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Modell '{model_name}' nicht gefunden.")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            # typischerweise DB/SQL/Preprocess Fehler
            raise HTTPException(status_code=503, detail=f"Prediction-Step fehlgeschlagen (DB/Pipeline): {e}")
       
        # WICHTIG: auch bei /predict/once muss latest funktionieren
        # /predict/latest liest aus dem PredictionService, also spiegeln wir das Ergebnis dort rein
        service._last_result = result
        service._model_name = model_name
        service._batch_size = batch_size
        service._stage1_threshold = stage1_threshold

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Prediction-Service starten: startet Hintergrundservice, der predict_once in Intervallen ausführt
@app.post("/predict/start")
def api_predict_start(
    interval: float = 1.0,
    model_name: str = "Random_Forest",
    batch_size: int = 50,
    stage1_threshold: float = 0.5,
    user=Depends(require_user),
):
    try:
        # 1) Input validieren
        if interval <= 0:
            raise HTTPException(status_code=400, detail="interval muss > 0 sein.")
        if batch_size <= 0:
            raise HTTPException(status_code=400, detail="batch_size muss > 0 sein.")

        # 2) Service starten
        try:
            started = service.start(
                interval=interval,
                model_name=model_name,
                batch_size=batch_size,
                stage1_threshold=stage1_threshold,
            )
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Modell '{model_name}' nicht gefunden.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Predict-Service konnte nicht gestartet werden: {e}")

        # Wenn schon läuft -> Conflict ist sauberer als "ok"
        if started is False:
            raise HTTPException(status_code=409, detail="Predict-Service läuft bereits.")

        return {
            "started": True,
            "status": service.status()
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Prediction stoppen: beendet den Hintergrundservice
@app.post("/predict/stop")
def api_predict_stop(user=Depends(require_user)):
    try:
        try:
            service.stop()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Predict-Service konnte nicht gestoppt werden: {e}")

        return {"stopped": True, "status": service.status()}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Prediction-Status: liefert Laufstatus
@app.get("/predict/status")
def api_predict_status(user=Depends(require_user)):
    try:
        try:
            return service.status()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Status konnte nicht gelesen werden: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Letzte Prediction: liefert Ausgabe der letzten Vorhersage
@app.get("/predict/latest")
def api_predict_latest(user=Depends(require_user)):
    try:
        st = service.status()

        last_result = st.get("last_result")
        if not last_result:
            # Kein Fehler: es gab einfach noch keine Runs
            raise HTTPException(
                status_code=404,
                detail="Noch kein Prediction-Ergebnis vorhanden. Bitte /predict/start oder /predict/once aufrufen."
            )

        records = last_result.get("records", [])
        if not records:
            # Kein Fehler in der Pipeline, aber aktuell nichts Neues
            raise HTTPException(
                status_code=204,
                detail="Kein neuer Record im letzten Ergebnis (keine neuen Daten)."
            )

        latest = records[-1]

        return {
            "running": st.get("running", False),
            "model_name": st.get("model_name"),
            "interval": st.get("interval"),
            "batch_size": st.get("batch_size"),
            "latest": latest,
            "summary": last_result.get("summary")
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Simulation starten: startet die Simulation, der in Intervallen neue Datensätze in die DB schreibt
@app.post("/simulation/start")
def simulation_start(interval: float = 1.0, user=Depends(require_user)):
    try:
        if interval <= 0:
            raise HTTPException(status_code=400, detail="interval muss > 0 sein.")

        try:
            result = sim_service.start(interval=interval)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Simulations-CSV nicht gefunden.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Simulation konnte nicht gestartet werden: {e}")

        # Falls Service schon läuft: 409
        if isinstance(result, dict) and result.get("started") is False:
            raise HTTPException(status_code=409, detail=result.get("message", "Simulation läuft bereits."))

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Simulation stoppen: beendet den Simulator
@app.post("/simulation/stop")
def simulation_stop(user=Depends(require_user)):
    try:
        try:
            return sim_service.stop()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Simulation konnte nicht gestoppt werden: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Status der Simulation anzeigen: liefert Laufstatus und Fortschritt des Simulationsservices
@app.get("/simulation/status")
def simulation_status(user=Depends(require_user)):
    try:
        try:
            return sim_service.status()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Simulation-Status konnte nicht gelesen werden: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Simulation zurücksetzen: setzt Simulationszustand zurück (z. B. Cursor/Checkpoint) und bereinigt ggf. DB
@app.post("/simulation/reset")
def simulation_reset(user=Depends(require_user)):
    try:
        try:
            result = sim_service.reset()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Simulation-Reset fehlgeschlagen: {e}")

        # Wenn nie gestartet -> 409 (Konflikt/Zustand)
        if isinstance(result, dict) and result.get("reset") is False:
            raise HTTPException(status_code=409, detail=result.get("message", "Reset nicht möglich."))

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# System-Reset: stoppt Services und setzt interne Zustände/Checkpoints (Simulation oder Replay)
@app.post("/system/reset_all")
def system_reset_all(
    mode: str = "simulation",
    delete_sim_data: bool = True,
    user=Depends(require_user),
):
    try:
        # mode validieren (sonst "silent wrong")
        if mode not in ("simulation", "replay"):
            raise HTTPException(status_code=400, detail="mode muss 'simulation' oder 'replay' sein.")

        try:
            sim_reset_result, checkpoint_info = reset_all_internal(
                prediction_service=service,
                simulation_service=sim_service,
                mode=mode,
                delete_sim_data=delete_sim_data,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"System-Reset fehlgeschlagen: {e}")

        return {
            "ok": True,
            "delete_sim_data": delete_sim_data,
            "simulation_reset": sim_reset_result,
            "checkpoint": checkpoint_info,
            "predict_status": service.status(),
            "simulation_status": sim_service.status(),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Demo-Start: führt Reset aus und startet anschließend Simulation + Prediction-Service für eine Demo
@app.post("/system/start_demo")
def system_start_demo(
    sim_interval: float = 1.0,
    predict_interval: float = 1.0,
    batch_size: int = 50,
    model_name: str = "Random_Forest",
    stage1_threshold: float = 0.5,
    mode: str = "simulation",
    delete_sim_data: bool = True,
    user=Depends(require_user),
):
    try:
        # Inputs validieren
        if sim_interval <= 0 or predict_interval <= 0:
            raise HTTPException(status_code=400, detail="sim_interval und predict_interval müssen > 0 sein.")
        if batch_size <= 0:
            raise HTTPException(status_code=400, detail="batch_size muss > 0 sein.")
        if mode not in ("simulation", "replay"):
            raise HTTPException(status_code=400, detail="mode muss 'simulation' oder 'replay' sein.")

        # Reset
        try:
            sim_reset_result, checkpoint_info = reset_all_internal(
                prediction_service=service,
                simulation_service=sim_service,
                mode=mode,
                delete_sim_data=delete_sim_data,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Reset vor Demo-Start fehlgeschlagen: {e}")

        # Simulation starten
        try:
            sim_start_result = sim_service.start(interval=sim_interval)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Simulation-Start fehlgeschlagen: {e}")

        # Predict starten
        try:
            started_predict = service.start(
                interval=predict_interval,
                model_name=model_name,
                batch_size=batch_size,
                stage1_threshold=stage1_threshold,
            )
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Modell '{model_name}' nicht gefunden.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Predict-Service Start fehlgeschlagen: {e}")

        # Wenn Predict schon läuft -> 409
        if started_predict is False:
            raise HTTPException(status_code=409, detail="Predict-Service läuft bereits.")

        return {
            "ok": True,
            "reset": {
                "simulation_reset": sim_reset_result,
                "checkpoint": checkpoint_info,
            },
            "simulation": sim_start_result,
            "prediction": {
                "started": True,
                "interval": predict_interval,
                "batch_size": batch_size,
                "model_name": model_name,
                "stage1_threshold": stage1_threshold,
                "status": service.status(),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Demo-Stop: stoppt Simulation und Prediction-Service
@app.post("/system/stop_demo")
def system_stop_demo(user=Depends(require_user)):
    try:
        # Idempotent: stoppt beide Dienste, egal ob sie laufen
        try:
            service.stop()
            sim_service.stop()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Stop Demo fehlgeschlagen: {e}")

        return {
            "stopped": True,
            "predict_status": service.status(),
            "simulation_status": sim_service.status()
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# Evaluation
# liefert Auswertungskriterien/Performance-Metriken für ein gewähltes Modell
@app.get("/evaluate_model")
def evaluate_model(model_name: ModelName = ModelName.random_forest, user=Depends(require_user)):
    try:
        try:
            result = evaluate_model_metrics(model_name.value)
            if result is None:
                raise HTTPException(status_code=500, detail="evaluate_model_metrics hat None zurückgegeben.")
            return result
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Modell '{model_name.value}' nicht gefunden.")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Evaluation fehlgeschlagen: {e}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/evaluate_failure_type")
def evaluate_failure_type(model_name: str = "Random_Forest_FailureType", user=Depends(require_user)):
    try:
        try:
            result = evaluate_failure_type_metrics(model_name)
            if result is None:
                raise HTTPException(status_code=500, detail="evaluate_failure_type_metrics hat None zurückgegeben.")
            return result
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Modell '{model_name}' nicht gefunden.")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failure-Type-Evaluation fehlgeschlagen: {e}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
