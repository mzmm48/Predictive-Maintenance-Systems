# TODO ersetzt mit preprocessing -> data_prepocessing
# TODO muss auch zu beginn aktiviert werden
import pandas as pd
import joblib
from pathlib import Path
from preprocessing import preprocess_raw_df

DATA_DIR = Path("../data")

df = pd.read_csv(DATA_DIR / "ai4i2020.csv")

df_preprocessing = preprocess_raw_df(df)

joblib.dump(df_preprocessing, DATA_DIR / "df_preprocessing.joblib")
joblib.dump(df, DATA_DIR / "df_original.joblib")

