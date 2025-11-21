# TODO wird von Test/Main aufgerufen
import pickle
import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay, roc_auc_score, RocCurveDisplay, \
    PrecisionRecallDisplay, precision_recall_curve, accuracy_score, classification_report
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('TkAgg')


def do_prediction(x_test, y_test, model_name: str = "Random_Forest"):
    with open(f"../data/models/{model_name}.pkl", "rb") as f:
        model_dict = pickle.load(f)

    model = model_dict['model']
    feature_names = model_dict['features']

    if isinstance(x_test, pd.DataFrame):
        missing = [c for c in feature_names if c not in x_test.columns]
        if missing:
            raise ValueError(f"Fehlende Features in x_test: {missing}")
        x_test = x_test[feature_names]  # richtige Reihenfolge + Auswahl

    if hasattr(model, "predict_proba"):
        y_prob = model.predict_proba(x_test)[:, 1]
    elif hasattr(model, "decision_function"):
        scores = model.decision_function(x_test)
        # in pseudo-probability mappen (sigmoid)
        y_prob = 1 / (1 + np.exp(-scores))
    else:
        y_prob = None

    threshold = 0.5

    if y_prob is not None:
        y_pred = (y_prob >= threshold).astype(int)
    else:
        y_pred = model.predict(x_test)

    print(f"Prediction results: {y_pred} | Probability: {y_prob}")

    return y_pred, y_prob


""" Hatt einen Standard Threshold
    y_pred = model.predict(x_test)
    y_prob = model.predict_proba(x_test)[:, 1]
"""
#    values, counts = np.unique(y_pred, return_counts=True)
#    print(values)
#    print(counts)
#    print(classification_report(y_test, y_pred))


# TODO auslagern in seperate Funktion
# TODO def visualize()
"""
    # Confusion Matrix
    cm = confusion_matrix(y_test, y_pred)
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=class_names)
    disp.plot(cmap='Blues')
    plt.show()

    # ROC Curve
    roc_auc = roc_auc_score(y_test, y_prob)
    RocCurveDisplay.from_predictions(y_test, y_prob)
    plt.show()

    # Precision-Recall Curve
    precision, recall, _ = precision_recall_curve(y_test, y_prob)
    PrecisionRecallDisplay(precision=precision, recall=recall).plot()
    plt.show()

    acc = accuracy_score(y_test,y_pred)

    print(acc)
    print(model)
"""
