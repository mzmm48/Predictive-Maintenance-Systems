# seed_ai4i_data.py – Einmaliges CSV-Importskript zum Befüllen der ai4i2020V2-Tabelle
#TODO Nicht nochmal ausführen - da nur benötigt wurde um vorhandenen Daten in die DB einzufügen
import csv
import time
from datetime import datetime, timedelta
import psycopg2
from pathlib import Path
from dotenv import load_dotenv
import os

#Verbindung zur DB
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

def build_conn_str() -> str:
    host = os.getenv("PMS_DB_HOST")
    port = os.getenv("PMS_DB_PORT", "5432")
    db   = os.getenv("PMS_DB_NAME")
    user = os.getenv("PMS_DB_USER")
    pwd  = os.getenv("PMS_DB_PASSWORD")
    ssl  = os.getenv("PMS_DB_SSLMODE", "require")

    missing = [k for k in ["PMS_DB_HOST", "PMS_DB_NAME", "PMS_DB_USER", "PMS_DB_PASSWORD"] if not os.getenv(k)]
    if missing:
        raise RuntimeError(f"Missing env vars: {missing}")

    # DSN-Format psycopg2 robust
    return (
        f"host={host} port={port} dbname={db} user={user} password={pwd} sslmode={ssl} "
        f"connect_timeout=5 options='-c statement_timeout=8000'"
    )

CONNECTION = build_conn_str()

# Import-Job: liest ai4i2020_train.csv ein und schreibt jede Zeile als Datensatz in ai4i2020V2 (TS wird pro Zeile inkrementiert)
with psycopg2.connect(CONNECTION) as conn:
    cursor = conn.cursor()

    start = datetime.now()

    t0 = time.perf_counter()
    count = 0

    # CSV lesen: Datei öffnen, Header überspringen, anschließend Zeile für Zeile in die DB inserten
    with open("../data/ai4i2020_train.csv", "r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        next(reader, None)  # Header überspringen

        for row in reader:
            # Datensatz einfügen: mappt CSV-Spalten auf DB-Spalten (inkl. Label-Spalten wie Machine failure und Failure-Types)
            cursor.execute(
                """
                INSERT INTO ai4i2020V2 (
                    "TS", "UDI", "Product ID", "Type", "Air temperature [K]",
                    "Process temperature [K]", "Rotational speed [rpm]", "Torque [Nm]",
                    "Tool wear [min]", "Machine failure", "TWF", "HDF", "PWF", "OSF", "RNF"
                )
                VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s
                )
                """,
                (
                    start,
                    row[0], row[1], row[2], row[3], row[4], row[5],
                    row[6], row[7], row[8], row[9], row[10], row[11],
                    row[12], row[13]
                )
            )

            start += timedelta(seconds=1)
            count += 1

            # Fortschritt alle 500 Zeilen ausgeben
            if count % 500 == 0:
                elapsed = time.perf_counter() - t0
                print(f"{count} Zeilen eingefügt nach {elapsed:.1f} Sekunden")

    # Commit + Abschlussausgabe: schreibt alle Inserts final in die DB und gibt Gesamtlaufzeit aus
    conn.commit()
    elapsed_total = time.perf_counter() - t0
    print(f"FERTIG: {count} Zeilen eingefügt in {elapsed_total:.2f} Sekunden")

    cursor.close()
