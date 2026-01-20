#TODO splittet die Daten für die Verwendung für die Datenbank. Wichtig ist das diese aufgeteilt werden und zwar in
# 90% und 10%. Die 90% sind für das reine einspielen in die DB mit anschließender verwendung der Vorhersage Modelle.
# Die restlichen 10% sind für die Simulierung einer Maschine da. Diese werden nur dann in die DB eingespielt wenn eine
# Simulation durchgeführt wird.
# Wird nur einmalig ausgeführt

import pandas as pd
from sklearn.model_selection import train_test_split

INPUT_PATH = "../data/ai4i2020.csv"
TRAIN_PATH = "../data/ai4i2020_train.csv"
SIM_PATH = "../data/ai4i2020_sim.csv"

#Trennt Originale CSV in Train und Sim Daten
def split_csv_stratified():
    df = pd.read_csv(INPUT_PATH)

    # Zielvariable
    y = df["Machine failure"]

    # Stratified Split: 90% / 10%
    df_train, df_sim = train_test_split(
        df,
        test_size=0.1,              # 1000 von 10000
        random_state=42,
        stratify=y
    )

    df_train.to_csv(TRAIN_PATH, index=False)
    df_sim.to_csv(SIM_PATH, index=False)

    print("Train size:", df_train.shape)
    print("Sim size:  ", df_sim.shape)

    print("\nFailure rate train:")
    print(df_train["Machine failure"].value_counts(normalize=True))

    print("\nFailure rate sim:")
    print(df_sim["Machine failure"].value_counts(normalize=True))


if __name__ == "__main__":
    split_csv_stratified()