import asyncio
import psycopg2
import pandas as pd
from datetime import datetime, timezone

# Simulationsdaten laden:
df_source = pd.read_csv("../data/ai4i2020_sim.csv")

# DB-Insert: schreibt genau eine Sensor-Messung in die Tabelle sensor_readings
def insert_sensor_reading(conn, row: dict, run_id: str | None = None):
    sql = """
      INSERT INTO sensor_readings(ts, machine_id, "Type","Air temperature [K]", "Process temperature [K]","Rotational speed [rpm]", "Torque [Nm]", "Tool wear [min]",processed, run_id)
      VALUES (%s, %s, %s, %s, %s, %s, %s, %s, FALSE, %s)
    """
    with conn.cursor() as cur:
        cur.execute(sql, (
            datetime.now(timezone.utc),
            1,
            row["Type"],
            row["Air temperature [K]"],
            row["Process temperature [K]"],
            row["Rotational speed [rpm]"],
            row["Torque [Nm]"],
            row["Tool wear [min]"],
            run_id
        ))

# Simulation-Loop: iteriert zyklisch durch df_source und schreibt im angegebenen Intervall neue Messwerte in die DB
async def simulation_loop(
    connection_string: str,
    interval_seconds: float,
    run_id: str
):
    idx = 0
    with psycopg2.connect(connection_string) as conn:
        while True:
            row = df_source.iloc[idx].to_dict()
            insert_sensor_reading(conn, row, run_id)
            conn.commit()

            idx = (idx + 1) % len(df_source)
            await asyncio.sleep(interval_seconds)