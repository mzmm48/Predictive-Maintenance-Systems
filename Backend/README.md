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

Aktivieren:
Windows 

.\.venv\Scripts\activate 

MacOS/Linux 

source .venv/bin/activate 

 

2) Requirements installieren 

python -m pip install -r Backend/requirements.txt 

 

Konfiguration (.env) 

Lege die Datei Backend/.env an (wichtig: nicht in src/, sondern im Backend/-Ordner): 

 

PMS_DB_HOST="..." 

PMS_DB_PORT="…" 

PMS_DB_NAME="…" 

PMS_DB_USER="…" 

PMS_DB_PASSWORD="…" 

PMS_DB_SSLMODE=disable 

 Hinweis: Ohne gültige DB-Verbindung starten viele Endpunkte nicht sinnvoll. 