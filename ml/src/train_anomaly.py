"""
train_anomaly.py
Machine Learning Exploratory Analysis: Isolation Forest
Detecting Cryptographic Anomalies and Transport Latency Spikes
"""

import os
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "..", "..", "data", "experiments", "scenario_1_crypto_benchmark.csv")
MODEL_DIR = os.path.join(BASE_DIR, "..", "models")
REPORT_DIR = os.path.join(BASE_DIR, "..", "reports")
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(REPORT_DIR, exist_ok=True)

if not os.path.exists(DATA_FILE):
    print("No crypto data found.")
    exit(0)

df = pd.read_csv(DATA_FILE)
# Create some artificial anomalies to test detection
# We'll spike the sig_verify_time_us for 5% of records
rng = np.random.RandomState(42)
anom_indices = rng.choice(df.index, size=int(len(df)*0.05), replace=False)
df.loc[anom_indices, 'sig_verify_time_us'] = df.loc[anom_indices, 'sig_verify_time_us'] * 10
df['is_synthetic_anomaly'] = False
df.loc[anom_indices, 'is_synthetic_anomaly'] = True

features = ["hash_time_us", "sig_verify_time_us", "throughput_mb_s"]
X = df[features]

model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
preds = model.fit_predict(X)
df['predicted_anomaly'] = np.where(preds == -1, True, False)

# Confusion logic for reporting
tp = ((df['is_synthetic_anomaly'] == True) & (df['predicted_anomaly'] == True)).sum()
fp = ((df['is_synthetic_anomaly'] == False) & (df['predicted_anomaly'] == True)).sum()

joblib.dump(model, os.path.join(MODEL_DIR, "isolation_forest.pkl"))

plt.figure(figsize=(7,5))
sns.scatterplot(data=df, x="hash_time_us", y="sig_verify_time_us", hue="predicted_anomaly", palette={False: "blue", True: "red"})
plt.title("Isolation Forest: Cryptographic Latency Anomaly Detection")
plt.xlabel("SHA-256 Hash Time (us)")
plt.ylabel("ECDSA Verify Time (us)")
plt.tight_layout()
plt.savefig(os.path.join(REPORT_DIR, "anomaly_detection.png"))
plt.close()

with open(os.path.join(REPORT_DIR, "anomaly_report.txt"), "w") as f:
    f.write(f"Isolation Forest Detected Anomalies: {df['predicted_anomaly'].sum()}\n")
    f.write(f"True Positives: {tp}\nFalse Positives: {fp}\n")

print("[OK] Isolation Forest trained and evaluated.")
