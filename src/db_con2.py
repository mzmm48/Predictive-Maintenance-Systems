#TODO verallgemeinert DB_con (anscheinend wird kein disconect benötigt

import psycopg2
import pandas as pd
from datetime import datetime

CONN_STR = "postgres://tsdbadmin:seleneares123@b0e1bmoiny.xe7d3cm2b8.tsdb.cloud.timescale.com:31840/tsdb?sslmode=require"


# -------------------------------------------------
# GENERISCHE HELFER
# -------------------------------------------------
def read_dataframe(sql: str, params=None) -> pd.DataFrame:
    """SELECT -> DataFrame"""
    with psycopg2.connect(CONN_STR) as conn:
        return pd.read_sql(sql, conn, params=params)


def execute(sql: str, params=None) -> None:
    """INSERT/UPDATE/DELETE"""
    with psycopg2.connect(CONN_STR) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()


# -------------------------------------------------
# DEMO / DEBUG: Rohdaten anzeigen
# -------------------------------------------------
def get_ai4i_data(limit: int = 100) -> pd.DataFrame:
    """
    Gibt Rohdaten aus ai4i2020V2 zurück (für Swagger / Debug).
    """
    sql = """
        SELECT *
        FROM "ai4i2020v2"
        ORDER BY "TS" ASC
        LIMIT %s;
    """
    return read_dataframe(sql, (limit,))


# -------------------------------------------------
# CHECKPOINT: pipeline_state
# -------------------------------------------------
def get_last_pred_ts() -> datetime:
    """
    Liest den letzten verarbeiteten Timestamp aus pipeline_state.
    Erwartet genau eine Zeile.
    """
    sql = "SELECT last_pred_ts FROM pipeline_state LIMIT 1;"
    with psycopg2.connect(CONN_STR) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            row = cur.fetchone()
            if row is None:
                raise RuntimeError(
                    "pipeline_state ist leer. Bitte initial eine Zeile einfügen."
                )
            return row[0]


def set_last_pred_ts(ts: datetime) -> None:
    """
    Aktualisiert den Checkpoint.
    """
    sql = "UPDATE pipeline_state SET last_pred_ts = %s;"
    execute(sql, (ts,))


# -------------------------------------------------
# NEUE DATEN SEIT CHECKPOINT HOLEN
# -------------------------------------------------
def fetch_new_ai4i_rows_since(last_ts: datetime, limit: int = 100) -> pd.DataFrame:
    """
    Holt neue Datensätze aus ai4i2020V2 mit TS > last_pred_ts.
    """
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

last_ts = get_last_pred_ts()


def get_training_data(limit: int | None = None) -> pd.DataFrame:
    """
    Holt Trainingsdaten aus der DB (inkl. Label Machine failure).
    Optional mit LIMIT.
    """
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
        FROM public."ai4i2020v2"
        ORDER BY "TS" ASC
    """
    if limit is not None:
        sql += " LIMIT %s;"
        return read_dataframe(sql, (limit,))
    else:
        sql += ";"
        return read_dataframe(sql)