#TODO veraltet wird nicht mehr benutzt
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
import joblib

df = pd.read_csv('../../data/ai4i2020.csv')

df_preprocessing = df.copy()

df_preprocessing.drop(columns=['UDI', 'Product ID', 'TWF', 'HDF', 'PWF', 'OSF', 'RNF'],inplace=True)
df_preprocessing['temperature_difference'] = df_preprocessing['Process temperature [K]'] - df['Air temperature [K]']
df_preprocessing['Mechanical Power [W]'] = np.round((df_preprocessing['Torque [Nm]'] * df_preprocessing['Rotational speed [rpm]']* 2 * np.pi) / 60,4)

df_preprocessing['Type'] = LabelEncoder().fit_transform(df['Type'])

joblib.dump(df_preprocessing, '../../data/df_preprocessing.joblib')
joblib.dump(df, '../../data/df_original.joblib')
