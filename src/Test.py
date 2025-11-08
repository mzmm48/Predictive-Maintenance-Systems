import pickle
import matplotlib
matplotlib.use('TkAgg')
import matplotlib.pyplot as plt
from sklearn import tree

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
    max_depth=2,
    proportion=True)
plt.show()
