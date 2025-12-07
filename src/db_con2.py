#TODO verallgemeinert DB_con (anscheinend wird kein disconect benötigt

import psycopg2
import pandas as pd

CONN_STR = "postgres://tsdbadmin:seleneares123@b0e1bmoiny.xe7d3cm2b8.tsdb.cloud.timescale.com:31840/tsdb?sslmode=require"

def get_ai4i_data(limit: int = 100) -> pd.DataFrame:
    sql = """SELECT * FROM ai4i2020 LIMIT %s;"""

    with psycopg2.connect(CONN_STR) as conn:
        df = pd.read_sql(sql, conn, params=(limit,))
    return df
