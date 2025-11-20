#TODO Hauptanwendung
import joblib
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from predict import do_prediction

berlin_tz = ZoneInfo("Europe/Berlin")

x_test = joblib.load('../data/X_test.joblib')
y_test = joblib.load('../data/Y_test.joblib')

x_test2 = x_test.reset_index(drop=True)
y_test2 = y_test.reset_index(drop=True)


def simulate_time_stream(x_test2, y_test2, delay_seconds=0.5):

    for i in range(len(x_test2)):
        n = i
        x_test = x_test2.iloc[[i]]
        y_test = y_test2.iloc[i]

        print("Index")
        print(n)
        now = datetime.now(berlin_tz)
        print(f"[{now:%Y-%m-%d %H:%M:%S}]")

        do_prediction(x_test, y_test, model_name='K-Nearest_Neighbors')

        time.sleep(delay_seconds)


simulate_time_stream(x_test, y_test)