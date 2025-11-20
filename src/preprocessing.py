#TODO ersetzt mit data_setup -> data_prepocessing
#TODO wird von data_setup aufgerufen
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder
import joblib
from pathlib import Path

DATA_DIR = Path("../data")

ORIGINAL_DF_PATH = DATA_DIR / "df_original.joblib"


def load_original_df():
    return joblib.load(ORIGINAL_DF_PATH)


#TODO Liest die Datei ein welche für das trainieren der Modelle verwendet wird
def preprocess_raw_df(df_raw: pd.DataFrame) -> pd.DataFrame:
    df_pre = df_raw.copy()

    df_pre.drop(columns=['UDI', 'Product ID', 'TWF', 'HDF', 'PWF', 'OSF', 'RNF'],
                inplace=True, errors="ignore")

    df_pre['temperature_difference'] = df_pre['Process temperature [K]'] - df_raw['Air temperature [K]']
    df_pre['Mechanical Power [W]'] = np.round(
        (df_pre['Torque [Nm]'] * df_pre['Rotational speed [rpm]'] * 2 * np.pi) / 60,
        4
    )

    df_pre['Type'] = LabelEncoder().fit_transform(df_raw['Type'])

    return df_pre


#TODO Liest die Daten, welches die Modelle Vorhersagen sollen
def preprocess_new_data(df_new_raw: pd.DataFrame) -> pd.DataFrame:
    df_pre = df_new_raw.copy()

    df_pre.drop(columns=['UDI', 'Product ID', 'TWF', 'HDF', 'PWF', 'OSF', 'RNF'],
                inplace=True, errors="ignore")

    df_pre['temperature_difference'] = df_pre['Process temperature [K]'] - df_new_raw['Air temperature [K]']
    df_pre['Mechanical Power [W]'] = np.round(
        (df_pre['Torque [Nm]'] * df_pre['Rotational speed [rpm]'] * 2 * np.pi) / 60,
        4
    )

    df_original = load_original_df()
    le = LabelEncoder()
    le.fit(df_original['Type'])

    df_pre['Type'] = le.transform(df_pre['Type'])

    return df_pre

