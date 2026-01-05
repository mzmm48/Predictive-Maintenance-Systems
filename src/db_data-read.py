#TODO Nicht nochmal ausführen - da nur benötigt wurde um vorhandenen Daten in die DB einzufügen
import csv
import time
from datetime import datetime, timedelta
import psycopg2

CONNECTION = "postgres://tsdbadmin:seleneares123@b0e1bmoiny.xe7d3cm2b8.tsdb.cloud.timescale.com:31840/tsdb?sslmode=require"

with psycopg2.connect(CONNECTION) as conn:
    cursor = conn.cursor()

    start = datetime.now()

    t0 = time.perf_counter()
    count = 0

    with open("../data/ai4i2020_train.csv", "r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        next(reader, None)  # Header überspringen

        for row in reader:
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

    conn.commit()
    elapsed_total = time.perf_counter() - t0
    print(f"FERTIG: {count} Zeilen eingefügt in {elapsed_total:.2f} Sekunden")

    cursor.close()
