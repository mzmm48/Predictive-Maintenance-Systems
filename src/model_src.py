import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression,LogisticRegressionCV,SGDClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier,AdaBoostClassifier,BaggingClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
import pickle
import os

"""
Hier werden die Verschiedenen Modelle initialisiert und Trainiert um später auf die 
einkommenden Daten angewendet zu werden
"""

df = pd.read_csv('../data/ai4i2020.csv')

data = df
data.drop(columns=['UDI', 'Product ID', 'TWF', 'HDF', 'PWF', 'OSF', 'RNF'],inplace=True)

data['Type'] = LabelEncoder().fit_transform(df['Type'])

X = data
y = data.pop("Machine failure")

"""
Wenn wir die Daten auf Trainings und Testdaten splitten müssten, aber da wir sowieso neue Daten noch generieren sollen, 
können wir diese einfach komplett für das Trainieren der Modelle verwenden.
#X_train, X_test, Y_train, Y_test = train_test_split(X, y, test_size=0.3, random_state=0)
"""

path = "../data/models"

models = {
    'Logistic Regression': LogisticRegression(max_iter=500, solver='lbfgs', random_state=0),
    'Logistic Regression CV': LogisticRegressionCV(cv=5, max_iter=500, solver='lbfgs', random_state=0),
    'SGD': SGDClassifier(max_iter=1000, tol=1e-3, random_state=0),
    'Random Forest': RandomForestClassifier(n_estimators=15, max_depth=2, random_state=0),
    'Gradient Boosting': GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=0),
    'AdaBoost': AdaBoostClassifier(n_estimators=50, learning_rate=1.0, random_state=0),
    'Bagging': BaggingClassifier(n_estimators=10, random_state=0),
    'Decision Tree': DecisionTreeClassifier(max_depth=4, random_state=0),
    'Support Vector Machine': SVC(kernel='linear', probability=True, random_state=0),
    'K-Nearest Neighbors': KNeighborsClassifier(n_neighbors=5)
}
def create_models(X, y):
    os.makedirs(path, exist_ok=True)
    feature_names = X.columns.tolist()
    for name, model in models.items():
        model.fit(X, y)
        filename = os.path.join(path, f"{name.replace(" ", "_")}" + '.pkl')
        with open(filename, "wb") as f:
            pickle.dump({'model': model, 'features': feature_names}, f)
        print(f"✅ {name} gespeichert unter {filename}")

create_models(X, y)