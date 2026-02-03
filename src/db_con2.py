# db_con2.py – Datenbankzugriff (PostgreSQL/Timescale) für Predictive-Maintenance-Backend
import os
import psycopg2
import pandas as pd
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

#Verbindung zur DB

#env laden
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

_CONN_STR = None

def get_conn_str() -> str:
    global _CONN_STR
    if _CONN_STR is None:
        _CONN_STR = build_conn_str()
    return _CONN_STR

# Generische Helfer

# SELECT-Helfer: führt eine SQL-SELECT-Query aus und liefert das Ergebnis als Pandas DataFrame zurück
def read_dataframe(sql: str, params=None) -> pd.DataFrame:
    """SELECT -> DataFrame"""
    with psycopg2.connect(get_conn_str()) as conn:
        return pd.read_sql(sql, conn, params=params)

# DML-Helfer: führt INSERT/UPDATE/DELETE aus und committet die Transaktion
def execute(sql: str, params=None) -> None:
    print("EXEC: connect...", flush=True)
    with psycopg2.connect(get_conn_str()) as conn:
        print("EXEC: connected", flush=True)
        with conn.cursor() as cur:
            print("EXEC: before cur.execute", flush=True)
            try:
                cur.execute(sql, params)
                conn.commit()
                print("Ok row count:", cur.rowcount)
            except psycopg2.errors as e:
                conn.rollback()
                print("Fehler", e)
                print("PG Code", e.pgcode)
                print("PG Error", e.pgerror)
            print("EXEC: after cur.execute", flush=True)
        print("EXEC: before commit", flush=True)
        conn.commit()
        print("EXEC: after commit", flush=True)



# DEMO / DEBUG: Rohdaten anzeigen

# Debug-Endpoint-Helper: liest Rohdaten aus ai4i2020v2 in zeitlicher Reihenfolge (für Swagger/Debug)
def get_ai4i_data(limit: int = 100) -> pd.DataFrame:
    sql = """
        SELECT *
        FROM "ai4i2020v2"
        ORDER BY "TS" ASC
        LIMIT %s;
    """
    return read_dataframe(sql, (limit,))


# CHECKPOINT: pipeline_state

# Checkpoint lesen: holt den zuletzt verarbeiteten Timestamp aus pipeline_state
def get_last_pred_ts() -> datetime:
    """
    Liest den letzten verarbeiteten Timestamp aus pipeline_state.
    Erwartet genau eine Zeile.
    """
    sql = "SELECT last_pred_ts FROM pipeline_state LIMIT 1;"
    with psycopg2.connect(get_conn_str()) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            row = cur.fetchone()
            if row is None:
                raise RuntimeError(
                    "pipeline_state ist leer. Bitte initial eine Zeile einfügen."
                )
            return row[0]

# Checkpoint schreiben: aktualisiert last_pred_ts in pipeline_state
def set_last_pred_ts(ts: datetime) -> None:
    """
    Aktualisiert den Checkpoint.
    """
    sql = "UPDATE pipeline_state SET last_pred_ts = %s;"
    execute(sql, (ts,))



# NEUE DATEN SEIT CHECKPOINT HOLEN

# Datenabruf: lädt neue ai4i2020v2-Zeilen mit TS > last_pred_ts
def fetch_new_ai4i_rows_since(last_ts: datetime, limit: int = 100) -> pd.DataFrame:
    sql = """
        SELECT
            "UDI",
            "TS",
            "Type",
            "Air temperature [K]",
            "Process temperature [K]",
            "Rotational speed [rpm]",
            "Torque [Nm]",
            "Tool wear [min]"
        FROM "ai4i2020v2"
        WHERE "TS" > %s
        ORDER BY "TS" ASC
        LIMIT %s;
    """
    return read_dataframe(sql, (last_ts, limit))

# Hilfsfunktion: liefert den maximalen Timestamp (TS) aus ai4i2020v2 (z. B. für initiales Setzen des Checkpoints)
def get_max_ts_ai4i() -> datetime:
    sql = 'SELECT MAX("TS") FROM "ai4i2020v2";'
    with psycopg2.connect(get_conn_str()) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            row = cur.fetchone()
            if row is None or row[0] is None:
                raise RuntimeError('Tabelle ai4i2020v2 ist leer oder "TS" ist NULL.')
            return row[0]

# Trainingsdaten laden: holt Daten inkl. Label-Spalten aus ai4i2020v2
def get_training_data(limit: int | None = None) -> pd.DataFrame:
    sql = """
        SELECT
            "UDI",
            "TS",
            "Product ID",
            "Type",
            "Air temperature [K]",
            "Process temperature [K]",
            "Rotational speed [rpm]",
            "Torque [Nm]",
            "Tool wear [min]",
            "Machine failure",
            "TWF", "HDF", "PWF", "OSF", "RNF"
        FROM "ai4i2020v2"
        ORDER BY "TS" ASC
    """
    if limit is not None:
        sql += " LIMIT %s;"
        return read_dataframe(sql, (limit,))
    else:
        sql += ";"
        return read_dataframe(sql)

# Replay-Reset: setzt den Checkpoint auf Epoch (1970) zurück, sodass alle vorhandenen Daten erneut verarbeitet werden
def reset_checkpoint_replay() -> None:
    sql = "UPDATE pipeline_state SET last_pred_ts = %s;"
    execute(sql, (datetime(1970, 1, 1, tzinfo=timezone.utc),))

# Betriebs-/Simulations-Reset: setzt Checkpoint auf den aktuellen DB-Max-TS, um historische Daten zu ignorieren
def reset_last_pred_ts_to_db_max() -> datetime:
    max_ts = get_max_ts_ai4i()
    set_last_pred_ts(max_ts)
    return max_ts

# Insert-Helper: fügt genau eine Zeile in ai4i2020v2 ein (für Simulation/Datengenerator)
def insert_ai4i_row(row: dict) -> None:
    sql = """
        INSERT INTO public."ai4i2020v2" (
            "UDI", "TS", "Product ID", "Type",
            "Air temperature [K]", "Process temperature [K]",
            "Rotational speed [rpm]", "Torque [Nm]", "Tool wear [min]",
            "Machine failure", "TWF", "HDF", "PWF", "OSF", "RNF"
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """
    params = (
        row.get("UDI"),
        row.get("TS"),
        row.get("Product ID"),
        row.get("Type"),
        row.get("Air temperature [K]"),
        row.get("Process temperature [K]"),
        row.get("Rotational speed [rpm]"),
        row.get("Torque [Nm]"),
        row.get("Tool wear [min]"),
        row.get("Machine failure", None),
        row.get("TWF", None),
        row.get("HDF", None),
        row.get("PWF", None),
        row.get("OSF", None),
        row.get("RNF", None),
    )
    print("BEFOR")
    execute(sql, params)
    print("AFTER")

# Delete-Helper: löscht alle Datensätze ab einem Timestamp (typisch: Simulationsdaten ab Startzeitpunkt entfernen)
def delete_ai4i_rows_since(ts_from: datetime) -> int:
    sql = 'DELETE FROM public."ai4i2020v2" WHERE "TS" >= %s;'
    with psycopg2.connect(get_conn_str()) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (ts_from,))
            deleted = cur.rowcount
        conn.commit()
    return deleted
