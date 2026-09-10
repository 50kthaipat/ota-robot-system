"""
train_regression.py — Random Forest Regression: Download Time Prediction
=========================================================================
ทำนายเวลาดาวน์โหลดเฟิร์มแวร์ (download_time_ms) จากปัจจัยต่าง ๆ

Features:
  - file_size_bytes        → ขนาดไฟล์เฟิร์มแวร์
  - network_latency_ms     → ความหน่วงเครือข่าย (derived จาก scenario name)
  - packet_loss_pct        → อัตราสูญหายของ packet (derived จาก scenario name)
  - hardware_model_enc     → ประเภทหุ่นยนต์ (label-encoded)

Target:
  - download_time_ms

Output:
  - models/random_forest_regressor.pkl
  - reports/feature_importance.png
  - reports/regression_report.txt
  - reports/prediction_vs_actual.png
"""

import os
import re
import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import LabelEncoder

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH  = os.path.join(BASE_DIR, "..", "data", "experiments", "master_experiment_dataset.csv")
MODEL_DIR  = os.path.join(BASE_DIR, "models")
REPORT_DIR = os.path.join(BASE_DIR, "reports")

os.makedirs(MODEL_DIR,  exist_ok=True)
os.makedirs(REPORT_DIR, exist_ok=True)

# ── Helper: Extract Network Conditions from Scenario Name ─────────────────────
def extract_latency_ms(scenario: str) -> float:
    """Extract simulated latency from scenario name string."""
    m = re.search(r"(\d+)ms", scenario)
    if m:
        return float(m.group(1))
    return 0.0

def extract_loss_pct(scenario: str) -> float:
    """Extract packet loss % from scenario name string."""
    m = re.search(r"loss(\d+)", scenario)
    if m:
        return float(m.group(1))
    return 0.0

# ── 1. Load Data ──────────────────────────────────────────────────────────────
print("=" * 60)
print("  OTA Download Time Prediction — Random Forest Regression")
print("=" * 60)

df = pd.read_csv(DATA_PATH)

# Only include rows with valid download times (network scenarios + nominal)
df_reg = df[
    (df["download_time_ms"] > 0) &
    (df["final_status"] == "SUCCESS")
].copy()

print(f"\n[INFO] Total records: {len(df)}")
print(f"[INFO] Regression-eligible (download_ms > 0, SUCCESS): {len(df_reg)}")

# ── 2. Feature Engineering ────────────────────────────────────────────────────
df_reg["network_latency_ms"] = df_reg["scenario"].apply(extract_latency_ms)
df_reg["packet_loss_pct"]    = df_reg["scenario"].apply(extract_loss_pct)

le = LabelEncoder()
df_reg["hardware_model_enc"] = le.fit_transform(df_reg["hardware_model"])

FEATURE_COLS = [
    "file_size_bytes",
    "network_latency_ms",
    "packet_loss_pct",
    "hardware_model_enc",
]
TARGET_COL = "download_time_ms"

X = df_reg[FEATURE_COLS].values
y = df_reg[TARGET_COL].values

print(f"\n[INFO] Features: {FEATURE_COLS}")
print(f"[INFO] Target  : {TARGET_COL}")
print(f"[INFO] y range : {y.min():.1f} ms – {y.max():.1f} ms  (mean={y.mean():.1f})")

# ── 3. Train / Test Split ─────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)
print(f"\n[INFO] Train: {len(X_train)} | Test: {len(X_test)}")

# ── 4. Train Random Forest ────────────────────────────────────────────────────
rf = RandomForestRegressor(
    n_estimators=300,
    max_depth=None,
    min_samples_split=2,
    random_state=42,
    n_jobs=-1,
)
rf.fit(X_train, y_train)

# ── 5. Evaluate ───────────────────────────────────────────────────────────────
y_pred = rf.predict(X_test)

mae   = mean_absolute_error(y_test, y_pred)
rmse  = np.sqrt(mean_squared_error(y_test, y_pred))
r2    = r2_score(y_test, y_pred)

# Cross-validation R² (5-fold)
cv_scores = cross_val_score(rf, X, y, cv=5, scoring="r2")

print("\n" + "=" * 60)
print("  REGRESSION METRICS (Test Set)")
print("=" * 60)
print(f"  MAE  (Mean Abs Error) : {mae:.2f} ms")
print(f"  RMSE (Root Mean Sq E) : {rmse:.2f} ms")
print(f"  R2   (Test set)       : {r2:.4f}")
print(f"  R2   (5-fold CV mean) : {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")

# ── 6. Save Report ────────────────────────────────────────────────────────────
report_path = os.path.join(REPORT_DIR, "regression_report.txt")
with open(report_path, "w", encoding="utf-8") as f:
    f.write("OTA Download Time Prediction — Random Forest Regression\n")
    f.write("=" * 60 + "\n\n")
    f.write(f"Training samples : {len(X_train)}\n")
    f.write(f"Test samples     : {len(X_test)}\n\n")
    f.write(f"MAE  : {mae:.2f} ms\n")
    f.write(f"RMSE : {rmse:.2f} ms\n")
    f.write(f"R²   (Test)      : {r2:.4f}\n")
    f.write(f"R²   (5-fold CV) : {cv_scores.mean():.4f} ± {cv_scores.std():.4f}\n\n")
    f.write("Feature Importances:\n")
    for feat, imp in sorted(zip(FEATURE_COLS, rf.feature_importances_), key=lambda x: -x[1]):
        f.write(f"  {feat:<28}: {imp:.4f}\n")
print(f"[INFO] Report saved → {report_path}")

# ── 7. Feature Importance Plot ────────────────────────────────────────────────
importances = rf.feature_importances_
feat_labels = [
    "File Size (bytes)",
    "Network Latency (ms)",
    "Packet Loss (%)",
    "Hardware Model",
]
sorted_idx = np.argsort(importances)

fig, ax = plt.subplots(figsize=(7, 4))
colors = ["#2196F3" if i == sorted_idx[-1] else "#90CAF9" for i in range(len(feat_labels))]
bars = ax.barh(
    [feat_labels[i] for i in sorted_idx],
    importances[sorted_idx],
    color=[colors[i] for i in sorted_idx],
    edgecolor="white",
    height=0.55,
)
for bar in bars:
    w = bar.get_width()
    ax.text(w + 0.005, bar.get_y() + bar.get_height() / 2,
            f"{w:.4f}", va="center", ha="left", fontsize=9)

ax.set_xlabel("Feature Importance (Gini)", fontsize=11)
ax.set_title(
    f"Feature Importance — Random Forest Regression\n"
    f"(Predicting Download Time,  R² = {r2:.4f})",
    fontsize=12, fontweight="bold"
)
ax.set_xlim(0, importances.max() + 0.08)
ax.grid(axis="x", alpha=0.3)
plt.tight_layout()
fi_path = os.path.join(REPORT_DIR, "feature_importance.png")
plt.savefig(fi_path, dpi=150, bbox_inches="tight")
plt.close()
print(f"[INFO] Feature importance plot saved → {fi_path}")

# ── 8. Predicted vs Actual Plot ───────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(6, 5))
ax.scatter(y_test, y_pred, alpha=0.6, s=25, color="#2196F3", edgecolors="none", label="Predictions")
lims = [min(y_test.min(), y_pred.min()) - 50, max(y_test.max(), y_pred.max()) + 50]
ax.plot(lims, lims, "r--", linewidth=1.5, label="Perfect Prediction")
ax.set_xlabel("Actual Download Time (ms)", fontsize=11)
ax.set_ylabel("Predicted Download Time (ms)", fontsize=11)
ax.set_title(
    f"Predicted vs Actual — Download Time\n(R² = {r2:.4f}, RMSE = {rmse:.1f} ms)",
    fontsize=12, fontweight="bold"
)
ax.legend(fontsize=9)
ax.grid(True, alpha=0.3)
plt.tight_layout()
pva_path = os.path.join(REPORT_DIR, "prediction_vs_actual.png")
plt.savefig(pva_path, dpi=150, bbox_inches="tight")
plt.close()
print(f"[INFO] Predicted vs Actual plot saved → {pva_path}")

# ── 9. Save Model ─────────────────────────────────────────────────────────────
joblib.dump(rf, os.path.join(MODEL_DIR, "random_forest_regressor.pkl"))
joblib.dump(le, os.path.join(MODEL_DIR, "hardware_label_encoder.pkl"))
print(f"\n[INFO] Models saved → {MODEL_DIR}/")
print("\n[SUCCESS] Regression training complete!")
