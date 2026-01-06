"""rom db_con2 import get_last_pred_ts, fetch_new_ai4i_rows_since

last_ts = get_last_pred_ts()
df = fetch_new_ai4i_rows_since(last_ts, limit=5)
print(df.head())

from db_con2 import get_training_data
from preprocessing import preprocess

df = get_training_data(limit=5)
print(df.columns)
X_pre = preprocess(df.drop(columns=["Machine failure"]))
print(X_pre.head())
"""
from predict_worker import predict_once

print(predict_once(model_name="Random_Forest", batch_size=20))