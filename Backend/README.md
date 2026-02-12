# Backend – Predictive Maintenance System
Dieses Backend stellt eine REST-API (FastAPI) bereit, um Sensordaten aus einer PostgreSQL/TimescaleDB zu lesen, 
Vorhersagen (Machine Failure) auszuführen und Demo-/Simulationsfunktionen zu steuern.  

## Voraussetzungen
**Python Version 3.12**
Zugriff auf eine **PostgreSQL-Datenbank** (mit Timescale-Erweiterung, falls genutzt)
(Optional) Daten bereits in der Tabelle **`ai4i2020v2`**
(Optional, aber empfohlen) Tabelle **`pipeline_state`** mit genau **einer** Zeile 

## Setup (lokal)
### 1) Virtuelle Umgebung erstellen (im Projekt-Root)
Bsp. in der Console:
python -m venv .venv 

#### Aktivieren:
Windows: \
.\.venv\Scripts\activate 

MacOS/Linux: \
source .venv/bin/activate 

### 2) Requirements installieren 

python -m pip install -r Backend/requirements.txt \
oder mit \
pip install -r Backend/requirements.txt 

### 3) Konfiguration (.env) 

Lege die Datei Backend/.env an (wichtig: nicht in src/, sondern im Backend/-Ordner): 

PMS_DB_HOST="..." \
PMS_DB_PORT="…"   \
PMS_DB_NAME="…"   \
PMS_DB_USER="…"   \
PMS_DB_PASSWORD="…"    \
PMS_DB_SSLMODE=disable 

Hinweis: Ohne gültige DB-Verbindung starten viele Endpunkte nicht sinnvoll.

## Backend starten
#### Aus dem Projekt-Root:
python -m uvicorn Backend.src.Controller:app --reload

Swagger UI:
http://127.0.0.1:8000/docs \
Health Check:
http://127.0.0.1:8000/

### Schnelltest (typischer Ablauf) nur für Swagger
POST /auth/login 
{
  "username": "…",
  "password": "…"
}
2) Daten holen (für Charts/Debug)
3) One-shot Prediction
POST /predict/once?model_name=Random_Forest&batch_size=50
4) Letztes Ergebnis abrufen
GET /predict/latest

## Demo-/Simulation (optional)

Simulation streamt Datensätze aus Backend/data/ai4i2020_sim.csv in die DB.
- POST /simulation/start
- GET /simulation/status
- POST /predict/start
- GET /predict/latest
- POST /predict/stop 
- POST /simulation/stop
- POST /simulation/reset (löscht Simulationsdaten ab Startzeitpunkt)
- optional: POST /system/reset_all (für nächste Demo komplett sauber) 

## Kombi-Demo (Reset + Start Simulation + Start Prediction):

- Start: POST /system/start_demo (startet Simulation und Prediciton)
- Prediction bekommen: GET /predict/latest (bekommt letzte Prediciton zurück)
- Stop: POST /system/stop_demo (beendet Simulation und Prediciton)
- POST /simulation/reset (löscht Simulationsdaten ab Startzeitpunkt)
- optional: POST /system/reset_all (für nächste Demo komplett sauber) 

## Model Storage (wichtig)

Für Live-Prediction müssen Modellartefakte vorhanden sein:

Modelle: Backend/data/models/*.pkl 
- falls nicht vorhanden bei train_models.py die auskommentierte Zeile #create_models(X_train_res, y_train_res, feature_names) 
ausführen

Testartefakte: Backend/data/X_test.joblib, Backend/data/Y_test.joblib (für Evaluation)

Wenn Modelle fehlen, liefern Prediction/Evaluation-Endpunkte typischerweise 404.

## Datenbank-Initialisierung (falls DB leer)
### (A) CSV splitten (einmalig) wenn noch nicht vorhanden
- Backend/src/split_dataset.py teilt ai4i2020.csv in Train/Sim:

### B) DB befüllen (einmalig)

Backend/src/db_data-read.py importiert ai4i2020_train.csv in ai4i2020v2:
- python Backend/src/db_data-read.py ausführen  \

Achtung: Dieses Skript ist als einmaliger Seed gedacht.

## Troubleshooting

pipeline_state ist leer
→ In pipeline_state muss eine Zeile existieren (Spalte last_pred_ts).

Model not found (404)
→ Prüfe Backend/data/models/ auf passende *.pkl (z. B. Random_Forest.pkl).

DB connection failed
→ .env prüfen (Host/Port/User/PW/SSLMode), DB erreichbar?

CORS im Browser
→ Frontend lokal über localhost:3000 oder localhost:5173 starten (ist freigeschaltet).