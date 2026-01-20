import numpy as np
import pandas as pd

# Mapping: kodiert den kategorischen Maschinentyp (L/M/H) in numerische Werte für ML-Modelle
TYPE_MAP = {"L": 0, "M": 1, "H": 2}

# Drop-Liste: entfernt Metadaten- und Label-Spalten
DROP_COLS = ['UDI', 'Product ID', 'TWF', 'HDF', 'PWF', 'OSF', 'RNF','TS']

# Preprocessing: bereitet Rohdaten für die Verwendung für die Modelle vor
def preprocess(df_raw: pd.DataFrame) -> pd.DataFrame:
    df = df_raw.copy()

    df.drop(columns=DROP_COLS, inplace=True, errors="ignore")

    df["temperature_difference"] = (df["Process temperature [K]"] - df["Air temperature [K]"])

    df["Mechanical Power [W]"] = np.round((df["Torque [Nm]"] * df["Rotational speed [rpm]"] * 2 * np.pi) / 60,4)

    df["Type"] = df["Type"].map(TYPE_MAP)

    return df
