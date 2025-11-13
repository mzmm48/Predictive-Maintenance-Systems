import joblib
from predict import do_prediction

x_test = joblib.load('../data/X_test.joblib')
y_test = joblib.load('../data/Y_test.joblib')

do_prediction(x_test, y_test)
