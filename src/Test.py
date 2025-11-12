import pickle
import numpy as np
import joblib
import matplotlib
matplotlib.use('TkAgg')
import matplotlib.pyplot as plt
from sklearn import tree
from sklearn.metrics import accuracy_score

df = joblib.load('../data/df_preprocessing.joblib')

df_new = df

n_rows = len(df_new)

numerical_cols = ['Air temperature [K]', 'Process temperature [K]',
                  'Rotational speed [rpm]', 'Torque [Nm]', 'Tool wear [min]', 'temperature_difference', 'Mechanical Power [W]']

for col in numerical_cols:
    df_new[col] = df[col].sample(n = n_rows, replace=True).values + np.random.normal(0, df[col].std()*0.05, n_rows)

# Kategorische Features per Sampling
categorical_cols = ['Type']
for col in categorical_cols:
    df_new[col] = np.random.choice(df[col].unique(), size= n_rows)

# Binäre Features per Sampling
binary_cols = ['Machine failure']
for col in binary_cols:
    probs = df[col].value_counts(normalize=True)
    df_new[col] = np.random.choice(probs.index, size= n_rows, p=probs.values)

print(df_new['Machine failure'].value_counts())

df_new = df.sample(frac=1, replace=False).reset_index(drop=True)

failure_indices = df_new.index[df_new['Machine failure'] == 1]
print(failure_indices)

failure_indices_df = df.index[df['Machine failure'] == 1]
print(failure_indices_df)

with open("../data/models/Random_Forest.pkl", "rb") as f:
    rf_model = pickle.load(f)

print("Geladen")

rf = rf_model['model']
feature_names = rf_model['features']
class_names = ["Kein Ausfall", "Ausfall"]

plt.figure(figsize=(15, 10))
tree.plot_tree(
    rf.estimators_[7],
    feature_names=feature_names,
    class_names=class_names,
    filled=True,
    max_depth=6,
    proportion=True)
plt.show()

X_new = df_new[feature_names]  # nur die trainierten Features
y_pred = rf.predict(X_new)
print(y_pred)

acc=accuracy_score(df_new['Machine failure'],y_pred)
print(acc)