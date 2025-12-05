#TODO Hauptanwendung
import pickle

import joblib
import time
from datetime import datetime
from zoneinfo import ZoneInfo

from matplotlib import pyplot as plt
from sklearn.metrics import classification_report, confusion_matrix, ConfusionMatrixDisplay

from predict import do_prediction

berlin_tz = ZoneInfo("Europe/Berlin")

x_test = joblib.load('../../data/X_test.joblib')
y_test = joblib.load('../../data/Y_test.joblib')

x_test2 = x_test.reset_index(drop=True)
y_test2 = y_test.reset_index(drop=True)


def simulate_time_stream(x_test2, y_test2, delay_seconds=0.01, model_name: str = 'Random_Forest'):

    for i in range(len(x_test2)):
        n = i
        x_test = x_test2.iloc[[i]]
        y_test = y_test2.iloc[i]

        print("Index")
        print(n)
        now = datetime.now(berlin_tz)
        print(f"[{now:%Y-%m-%d %H:%M:%S}]")

        do_prediction(x_test, y_test, model_name= model_name)

        time.sleep(delay_seconds)


def evaluate_model(X_test, y_test, model_name="Random_Forest"):
    with open(f"../data/models/{model_name}.pkl", "rb") as f:
        model_dict = pickle.load(f)

    model = model_dict['model']
    feature_names = model_dict['features']
    class_names = ["Kein Ausfall", "Ausfall"]

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    print(f"--------- {model_name} Classification Report ------ \n\n")
    print(classification_report(y_test, y_pred))

    # Confusion Matrix
    cm = confusion_matrix(y_test, y_pred)
    disp = ConfusionMatrixDisplay(confusion_matrix=cm)
    disp.plot(cmap='Blues')
    plt.title(f"{model_name} - Confusion Matrix")
    plt.show()


evaluate_model(x_test, y_test, "Random_Forest")

simulate_time_stream(x_test, y_test)