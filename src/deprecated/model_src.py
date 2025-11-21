#TODO muss zu begin aktiviert werden
import joblib
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression,LogisticRegressionCV,SGDClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier,AdaBoostClassifier,BaggingClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from imblearn.over_sampling import SMOTE
import pickle
import os

"""
Hier werden die Verschiedenen Modelle initialisiert und Trainiert um später auf die 
einkommenden Daten angewendet zu werden
"""

df = joblib.load('../../data/df_preprocessing.joblib')

X = df
y = df.pop("Machine failure")

smote = SMOTE(random_state=42)
X_resampled, y_resampled = smote.fit_resample(X, y)

X_train, X_test, Y_train, Y_test=train_test_split(X_resampled,y_resampled,test_size=0.3, random_state=0)

"""
Wenn wir die Daten auf Trainings und Testdaten splitten müssten, aber da wir sowieso neue Daten noch generieren sollen, 
können wir diese einfach komplett für das Trainieren der Modelle verwenden.
#X_train, X_test, Y_train, Y_test = train_test_split(X, y, test_size=0.3, random_state=0)
"""

path = "../../data/models"

models = {
    'Logistic Regression': LogisticRegression(max_iter=500, solver='lbfgs', random_state=0),
    'Logistic Regression CV': LogisticRegressionCV(cv=5, max_iter=500, solver='lbfgs', random_state=0),
    'SGD': SGDClassifier(max_iter=1000, tol=1e-3, random_state=0),
    'Random Forest': RandomForestClassifier(n_estimators=15, max_depth=6, class_weight='balanced', random_state=0),
    'Gradient Boosting': GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=0),
    'AdaBoost': AdaBoostClassifier(n_estimators=50, learning_rate=1.0, random_state=0),
    'Bagging': BaggingClassifier(n_estimators=10, random_state=0),
    'Decision Tree': DecisionTreeClassifier(max_depth=4, random_state=0),
    #'Support Vector Machine': SVC(kernel='linear', probability=True, random_state=0), #TODO lädt nicht
    'K-Nearest Neighbors': KNeighborsClassifier(n_neighbors=5)
}


def create_models(X_train, Y_train):
    os.makedirs(path, exist_ok=True)
    feature_names = X_resampled.columns.tolist()
    for name, model in models.items():
        model.fit(X_train, Y_train)
        filename = os.path.join(path, f"{name.replace(" ", "_")}" + '.pkl')
        with open(filename, "wb") as f:
            pickle.dump({'model': model, 'features': feature_names}, f)
        print(f"✅ {name} gespeichert unter {filename}")


joblib.dump(X_test, '../../data/X_test.joblib')
joblib.dump(Y_test, '../../data/Y_test.joblib')

create_models(X_resampled, y_resampled)