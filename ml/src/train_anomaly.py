"""
train_anomaly.py — Isolation Forest Anomaly Detection
=======================================================
ตรวจจับ anomalous update events จาก master experiment dataset
โดยใช้ Isolation Forest algorithm (unsupervised)

Features ที่ใช้:
  - download_time_ms
  - hash_verify_time_ms
  - signature_verify_time_ms
  - reboot_apply_time_ms
  - total_duration_ms

Labels (ground truth for evaluation):
  - final_status: SUCCESS → normal (0), ทุกอย่างอื่น → anomaly (1)

Output:
  - models/isolation_forest.pkl
  - reports/confusion_matrix.png
  - reports/roc_curve.png
  - reports/anomaly_detection_report.txt
"""

import os
import sys
import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    confusion_matrix,
    classification_report,
    roc_curve,
    roc_auc_score,
    ConfusionMatrixDisplay,
)

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH  = os.path.join(BASE_DIR, "..", "data", "experiments", "master_experiment_dataset.csv")
MODEL_DIR  = os.path.join(BASE_DIR, "models")
REPORT_DIR = os.path.join(BASE_DIR, "reports")

os.makedirs(MODEL_DIR,  exist_ok=True)
os.makedirs(REPORT_DIR, exist_ok=True)

# ── 1. Load & Prepare Data ────────────────────────────────────────────────────
print("=" * 60)
print("  OTA Anomaly Detection — Isolation Forest")
print("=" * 60)

df = pd.read_csv(DATA_PATH)
print(f"\n[INFO] Loaded {len(df)} records from master dataset")
print(f"[INFO] Scenarios: {df['scenario'].unique()}")

# Feature columns used for anomaly detection
FEATURE_COLS = [
    "download_time_ms",
    "hash_verify_time_ms",
    "signature_verify_time_ms",
    "reboot_apply_time_ms",
    "total_duration_ms",
]

# Only use rows with non-zero numeric values (exclude protected nodes with 0s)
df_model = df[df["download_time_ms"] > 0].copy()

# Ground truth: SUCCESS = 0 (normal), anything else = 1 (anomaly)
df_model["is_anomaly"] = (df_model["final_status"] != "SUCCESS").astype(int)

X = df_model[FEATURE_COLS].values
y_true = df_model["is_anomaly"].values

print(f"\n[INFO] Usable records (download_time_ms > 0): {len(df_model)}")
print(f"[INFO] Normal (SUCCESS): {(y_true == 0).sum()}")
print(f"[INFO] Anomaly (non-SUCCESS): {(y_true == 1).sum()}")

# ── 2. Scale Features ─────────────────────────────────────────────────────────
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# ── 3. Train Isolation Forest ─────────────────────────────────────────────────
# IsolationForest requires contamination in (0.0, 0.5]
contamination_rate = min(y_true.mean(), 0.5)
# Ensure at least a small value if there are no anomalies
if contamination_rate <= 0.0:
    contamination_rate = 0.05
print(f"\n[INFO] Contamination rate (clamped to ≤ 0.5): {contamination_rate:.4f}")

iso_forest = IsolationForest(
    n_estimators=200,
    contamination=float(contamination_rate),
    max_samples="auto",
    random_state=42,
    n_jobs=-1,
)
iso_forest.fit(X_scaled)

# Isolation Forest returns: -1 = anomaly, 1 = normal
raw_preds = iso_forest.predict(X_scaled)
y_pred = np.where(raw_preds == -1, 1, 0)   # convert to 0/1

# Anomaly score (higher = more anomalous)
scores = -iso_forest.decision_function(X_scaled)  # negate so higher = more anomalous

# ── 4. Evaluation ─────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("  EVALUATION RESULTS")
print("=" * 60)

report = classification_report(y_true, y_pred, target_names=["Normal", "Anomaly"])
print(report)

try:
    auc = roc_auc_score(y_true, scores)
    print(f"  ROC-AUC Score : {auc:.4f}")
except Exception as e:
    auc = None
    print(f"  ROC-AUC: N/A ({e})")

# ── 5. Save Report Text ───────────────────────────────────────────────────────
report_path = os.path.join(REPORT_DIR, "anomaly_detection_report.txt")
with open(report_path, "w", encoding="utf-8") as f:
    f.write("OTA Anomaly Detection — Isolation Forest\n")
    f.write("=" * 60 + "\n\n")
    f.write(f"Dataset size (usable records): {len(df_model)}\n")
    f.write(f"Normal records:  {(y_true == 0).sum()}\n")
    f.write(f"Anomaly records: {(y_true == 1).sum()}\n")
    f.write(f"Contamination:   {contamination_rate:.4f}\n\n")
    f.write("Classification Report:\n")
    f.write(report + "\n")
    if auc is not None:
        f.write(f"ROC-AUC Score: {auc:.4f}\n")
print(f"\n[INFO] Report saved → {report_path}")

# ── 6. Plot Confusion Matrix ──────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(6, 5))
cm = confusion_matrix(y_true, y_pred)
disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=["Normal", "Anomaly"])
disp.plot(ax=ax, colorbar=True, cmap="Blues")
ax.set_title("Isolation Forest — Confusion Matrix\n(OTA Firmware Update Anomaly Detection)", fontsize=12, fontweight="bold")
plt.tight_layout()
cm_path = os.path.join(REPORT_DIR, "confusion_matrix.png")
plt.savefig(cm_path, dpi=150, bbox_inches="tight")
plt.close()
print(f"[INFO] Confusion matrix saved → {cm_path}")

# ── 7. Plot ROC Curve ─────────────────────────────────────────────────────────
if auc is not None:
    fpr, tpr, _ = roc_curve(y_true, scores)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot(fpr, tpr, color="#2196F3", linewidth=2, label=f"Isolation Forest (AUC = {auc:.4f})")
    ax.plot([0, 1], [0, 1], "k--", linewidth=1, label="Random Baseline")
    ax.fill_between(fpr, tpr, alpha=0.1, color="#2196F3")
    ax.set_xlabel("False Positive Rate", fontsize=12)
    ax.set_ylabel("True Positive Rate (Recall)", fontsize=12)
    ax.set_title("ROC Curve — OTA Anomaly Detection\n(Isolation Forest, NIST P-256 Scenarios)", fontsize=12, fontweight="bold")
    ax.legend(loc="lower right", fontsize=10)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    roc_path = os.path.join(REPORT_DIR, "roc_curve.png")
    plt.savefig(roc_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[INFO] ROC curve saved → {roc_path}")

# ── 8. Save Model ─────────────────────────────────────────────────────────────
joblib.dump(iso_forest, os.path.join(MODEL_DIR, "isolation_forest.pkl"))
joblib.dump(scaler,     os.path.join(MODEL_DIR, "anomaly_scaler.pkl"))
print(f"\n[INFO] Models saved → {MODEL_DIR}/")
print("\n✅  Anomaly detection training complete!")
