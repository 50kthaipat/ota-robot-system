"""
train_regression.py
Machine Learning Exploratory Analysis: Random Forest Regression
Predicting Download Duration based on Network Jitter and Packet Loss
"""

import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "..", "..", "data", "experiments", "scenario_4_network_stress.csv")
MODEL_DIR = os.path.join(BASE_DIR, "..", "models")
REPORT_DIR = os.path.join(BASE_DIR, "..", "reports")
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(REPORT_DIR, exist_ok=True)

if not os.path.exists(DATA_FILE):
    print("No network data found.")
    exit(0)

df = pd.read_csv(DATA_FILE)
features = ["latency_baseline_ms", "packet_loss_pct", "mqtt_ack_latency_ms", "retransmission_count"]
target = "download_duration_ms"

X = df[features]
y = df[target]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
r2 = r2_score(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))

print(f"Random Forest Regression (Network Stress)")
print(f"R^2 Score: {r2:.4f}")
print(f"RMSE: {rmse:.2f} ms")

joblib.dump(model, os.path.join(MODEL_DIR, "random_forest_regressor.pkl"))

# Feature Importance
imp = pd.Series(model.feature_importances_, index=features).sort_values(ascending=False)
plt.figure(figsize=(6,4))
sns.barplot(x=imp.values, y=imp.index, palette="viridis")
plt.title("Feature Importance (Predicting Download Duration)")
plt.xlabel("Relative Importance")
plt.tight_layout()
plt.savefig(os.path.join(REPORT_DIR, "feature_importance.png"))
plt.close()

# Prediction vs Actual
plt.figure(figsize=(6,4))
plt.scatter(y_test, y_pred, alpha=0.7, color="blue")
plt.plot([y.min(), y.max()], [y.min(), y.max()], 'r--', lw=2)
plt.title("Actual vs Predicted Download Duration")
plt.xlabel("Actual Duration (ms)")
plt.ylabel("Predicted Duration (ms)")
plt.tight_layout()
plt.savefig(os.path.join(REPORT_DIR, "prediction_vs_actual.png"))
plt.close()

with open(os.path.join(REPORT_DIR, "regression_report.txt"), "w") as f:
    f.write(f"R^2: {r2:.4f}\nRMSE: {rmse:.2f} ms\nFeatures: {list(imp.index)}\n")
