"""
statistical_analysis.py — Academic Statistical Analysis for Thesis Chapter 4
==============================================================================
วิเคราะห์ข้อมูลเชิงสถิติจากชุดการทดลอง 5 สถานการณ์

Output:
  - Descriptive statistics table per scenario (mean, std, median, IQR, CI95%)
  - Mann-Whitney U Test: Canary vs Direct (Scenario 3)
  - 95% Confidence Intervals for key KPIs
  - Box Plot comparison across scenarios
  - CDF (Cumulative Distribution) of download time
  - LaTeX-ready tables (copy-paste into thesis)
  - reports/statistical_report.txt
"""

import os
import re
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
from scipy.stats import mannwhitneyu, shapiro

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_DIR   = os.path.join(BASE_DIR, "..", "data", "experiments")
REPORT_DIR = os.path.join(BASE_DIR, "..", "ml", "reports")

os.makedirs(REPORT_DIR, exist_ok=True)

MASTER_CSV = os.path.join(DATA_DIR, "master_experiment_dataset.csv")
SC3_CSV    = os.path.join(DATA_DIR, "scenario_3_rollback_comparison_raw.csv")
SC4_CSV    = os.path.join(DATA_DIR, "scenario_4_network_stress_raw.csv")

# ── Plot Style ────────────────────────────────────────────────────────────────
plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "axes.spines.top": False,
    "axes.spines.right": False,
    "figure.dpi": 150,
})
PALETTE = ["#2196F3", "#4CAF50", "#FF5722", "#9C27B0", "#FF9800"]

report_lines = []

def log(msg: str = ""):
    print(msg)
    report_lines.append(msg)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — Descriptive Statistics per Scenario
# ═══════════════════════════════════════════════════════════════════════════════
log("=" * 70)
log("  SECTION 1: Descriptive Statistics by Scenario")
log("=" * 70)

df = pd.read_csv(MASTER_CSV)
df_valid = df[(df["download_time_ms"] > 0) & (df["final_status"] == "SUCCESS")].copy()

METRIC_COLS = ["download_time_ms", "hash_verify_time_ms", "signature_verify_time_ms", "total_duration_ms"]

def ci95(data):
    n = len(data)
    if n < 2:
        return (np.nan, np.nan)
    se = stats.sem(data)
    m  = np.mean(data)
    h  = se * stats.t.ppf(0.975, df=n-1)
    return (m - h, m + h)

rows = []
for scenario, grp in df_valid.groupby("scenario"):
    for col in METRIC_COLS:
        d = grp[col].dropna().values
        lo, hi = ci95(d)
        rows.append({
            "scenario":  scenario,
            "metric":    col,
            "n":         len(d),
            "mean":      round(np.mean(d), 2),
            "std":       round(np.std(d, ddof=1), 2),
            "median":    round(np.median(d), 2),
            "IQR":       round(np.percentile(d, 75) - np.percentile(d, 25), 2),
            "CI95_lo":   round(lo, 2),
            "CI95_hi":   round(hi, 2),
        })

desc_df = pd.DataFrame(rows)

# Show condensed view for download_time_ms
pivot = desc_df[desc_df["metric"] == "download_time_ms"][
    ["scenario", "n", "mean", "std", "median", "IQR", "CI95_lo", "CI95_hi"]
]
log("\n[download_time_ms] Descriptive Statistics (ms):")
log(pivot.to_string(index=False))

# LaTeX table
latex_table = pivot.to_latex(index=False, caption="Descriptive Statistics of Download Time by Scenario",
                              label="tab:desc_stats", float_format="%.2f")
log("\n--- LaTeX (copy to thesis) ---")
log(latex_table)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — Mann-Whitney U Test: Canary vs Direct Deployment
# ═══════════════════════════════════════════════════════════════════════════════
log("\n" + "=" * 70)
log("  SECTION 2: Mann-Whitney U Test — Canary vs Direct (Scenario 3)")
log("=" * 70)

df3 = pd.read_csv(SC3_CSV)

# Direct deployment: all robots crash (CRASH_MANUAL_RECOVERED)
direct = df3[df3["scenario"] == "fault_direct_deployment_crash"]["rollback_time_ms"].values
direct = direct[direct > 0]

# Canary: only sentinel robot gets rolled back
canary = df3[df3["scenario"] == "fault_canary_rollout_phase1_sentinel"]["rollback_time_ms"].values
canary = canary[canary > 0]

log(f"\n  Direct Deployment rollback_time_ms → N={len(direct)}, mean={direct.mean():.1f}ms, std={direct.std(ddof=1):.1f}ms")
log(f"  Canary Rollout   rollback_time_ms → N={len(canary)}, mean={canary.mean():.1f}ms, std={canary.std(ddof=1):.1f}ms")

# Normality check (Shapiro-Wilk)
if len(direct) >= 3:
    stat_d, p_d = shapiro(direct)
    log(f"\n  Shapiro-Wilk (Direct): W={stat_d:.4f}, p={p_d:.4f} → {'Normal' if p_d > 0.05 else 'Not Normal'}")
if len(canary) >= 3:
    stat_c, p_c = shapiro(canary)
    log(f"  Shapiro-Wilk (Canary): W={stat_c:.4f}, p={p_c:.4f} → {'Normal' if p_c > 0.05 else 'Not Normal'}")

# Mann-Whitney U (non-parametric, suitable for small N)
if len(direct) >= 2 and len(canary) >= 2:
    u_stat, p_val = mannwhitneyu(direct, canary, alternative="two-sided")
    log(f"\n  Mann-Whitney U statistic : {u_stat:.1f}")
    log(f"  p-value                  : {p_val:.6f}")
    log(f"  Significance (alpha=0.05): {'Significant (H0 rejected)' if p_val < 0.05 else 'Not Significant'}")

    # Effect size (rank-biserial correlation)
    n1, n2 = len(direct), len(canary)
    r_rb = 1 - (2 * u_stat) / (n1 * n2)
    log(f"  Effect size (r_rb)       : {r_rb:.4f}  ({'Large' if abs(r_rb) >= 0.5 else 'Medium' if abs(r_rb) >= 0.3 else 'Small'})")

# 95% CI for each group
lo_d, hi_d = ci95(direct) if len(direct) >= 2 else (np.nan, np.nan)
lo_c, hi_c = ci95(canary) if len(canary) >= 2 else (np.nan, np.nan)
log(f"\n  95% CI — Direct : [{lo_d:.1f}, {hi_d:.1f}] ms")
log(f"  95% CI — Canary : [{lo_c:.1f}, {hi_c:.1f}] ms")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — ECDSA Overhead CI
# ═══════════════════════════════════════════════════════════════════════════════
log("\n" + "=" * 70)
log("  SECTION 3: ECDSA Signature Verification — 95% Confidence Interval")
log("=" * 70)

ecdsa_data = df_valid["signature_verify_time_ms"].dropna().values
lo_e, hi_e = ci95(ecdsa_data)
log(f"\n  N = {len(ecdsa_data)}")
log(f"  Mean   : {ecdsa_data.mean():.3f} ms")
log(f"  Std    : {ecdsa_data.std(ddof=1):.3f} ms")
log(f"  Median : {np.median(ecdsa_data):.3f} ms")
log(f"  95% CI : [{lo_e:.3f}, {hi_e:.3f}] ms")
log(f"  Max    : {ecdsa_data.max():.3f} ms")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — Fleet Survival Rate Summary
# ═══════════════════════════════════════════════════════════════════════════════
log("\n" + "=" * 70)
log("  SECTION 4: Fleet Survival Rate — Direct vs Canary")
log("=" * 70)

df3_all = pd.read_csv(SC3_CSV)
direct_total    = len(df3_all[df3_all["scenario"] == "fault_direct_deployment_crash"])
direct_crash    = len(df3_all[(df3_all["scenario"] == "fault_direct_deployment_crash") &
                               (df3_all["final_status"] == "CRASH_MANUAL_RECOVERED")])
canary_sentinel = len(df3_all[df3_all["scenario"] == "fault_canary_rollout_phase1_sentinel"])
canary_rollback = len(df3_all[(df3_all["scenario"] == "fault_canary_rollout_phase1_sentinel") &
                               (df3_all["final_status"] == "ROLLED_BACK_AUTO")])
canary_protected = len(df3_all[df3_all["scenario"] == "fault_canary_rollout_protected_nodes"])
canary_untouched = len(df3_all[(df3_all["scenario"] == "fault_canary_rollout_protected_nodes") &
                                (df3_all["final_status"] == "PROTECTED_UNTOUCHED")])

direct_failure_rate = (direct_crash / direct_total * 100) if direct_total > 0 else 0
canary_survival_rate = ((canary_protected) / (canary_sentinel + canary_protected) * 100) if (canary_sentinel + canary_protected) > 0 else 0

log(f"\n  === Direct Deployment ===")
log(f"  Total robots affected : {direct_total}")
log(f"  Crashed & required manual recovery: {direct_crash} ({direct_failure_rate:.0f}%)")
log(f"  Fleet Failure Rate    : {direct_failure_rate:.0f}%")
log(f"\n  === Canary Rollout ===")
log(f"  Sentinel robots (Phase 1): {canary_sentinel}")
log(f"  Sentinel rolled back auto: {canary_rollback} ({canary_rollback/canary_sentinel*100:.0f}% if sentinel>0)")
log(f"  Protected robots (untouched): {canary_untouched}/{canary_protected}")
log(f"  Fleet Survival Rate   : {canary_survival_rate:.0f}%")

# ═══════════════════════════════════════════════════════════════════════════════
# PLOTS
# ═══════════════════════════════════════════════════════════════════════════════

# ── Plot 1: Box Plot — Download Time per Network Scenario ────────────────────
df4 = pd.read_csv(SC4_CSV)
df4_valid = df4[df4["download_time_ms"] > 0].copy()

def extract_latency(s):
    m = re.search(r"(\d+)ms", s)
    return int(m.group(1)) if m else 0

df4_valid["latency_ms"] = df4_valid["scenario"].apply(extract_latency)
df4_valid["scenario_label"] = df4_valid["scenario"].apply(
    lambda s: re.sub(r"net_", "", s).replace("_", " ").title()
)

order_map = {0: "0ms", 150: "150ms", 300: "300ms", 500: "500ms"}
df4_valid["latency_label"] = df4_valid["latency_ms"].map(order_map).fillna("Other")

fig, ax = plt.subplots(figsize=(8, 5))
sns.boxplot(
    data=df4_valid, x="latency_label", y="download_time_ms",
    order=["0ms", "150ms", "300ms", "500ms"],
    palette=PALETTE, width=0.5, linewidth=1.5, ax=ax
)
ax.set_xlabel("Simulated Network Latency", fontsize=12)
ax.set_ylabel("Download Time (ms)", fontsize=12)
ax.set_title("Download Time Distribution under Network Stress\n(Scenario 4: Adverse Network Conditions)", fontsize=13, fontweight="bold")
ax.grid(axis="y", alpha=0.3)
plt.tight_layout()
plt.savefig(os.path.join(REPORT_DIR, "boxplot_download_by_network.png"), dpi=150, bbox_inches="tight")
plt.close()
log("\n[INFO] Box plot saved → reports/boxplot_download_by_network.png")

# ── Plot 2: CDF of download_time_ms (Nominal vs Network Stress) ────────────
df_nom = df_valid[df_valid["scenario"] == "nominal_baseline"]["download_time_ms"]
df_net = df4_valid[df4_valid["latency_ms"] > 0]["download_time_ms"]

fig, ax = plt.subplots(figsize=(7, 5))
for data, label, color in [
    (df_nom, "Nominal (0ms latency)", "#2196F3"),
    (df_net, "Network Stress (150–500ms)", "#FF5722"),
]:
    sorted_d = np.sort(data)
    cdf = np.arange(1, len(sorted_d) + 1) / len(sorted_d)
    ax.plot(sorted_d, cdf, linewidth=2, label=label, color=color)

ax.set_xlabel("Download Time (ms)", fontsize=12)
ax.set_ylabel("Cumulative Probability", fontsize=12)
ax.set_title("CDF of Firmware Download Time\n(Nominal vs Network-Stressed Conditions)", fontsize=13, fontweight="bold")
ax.legend(fontsize=10)
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig(os.path.join(REPORT_DIR, "cdf_download_time.png"), dpi=150, bbox_inches="tight")
plt.close()
log("[INFO] CDF plot saved → reports/cdf_download_time.png")

# ── Plot 3: Bar Chart — Fleet Survival Rate Comparison ───────────────────────
fig, ax = plt.subplots(figsize=(6, 4))
strategies  = ["Direct\nDeployment", "Canary\nRollout"]
failure_rates = [direct_failure_rate, 100 - canary_survival_rate]
survival_rates = [100 - direct_failure_rate, canary_survival_rate]

x = np.arange(len(strategies))
w = 0.35
ax.bar(x - w/2, survival_rates, w, label="Survived", color="#4CAF50", edgecolor="white")
ax.bar(x + w/2, failure_rates,  w, label="Failed / Crashed", color="#F44336", edgecolor="white")

for i, (s, f) in enumerate(zip(survival_rates, failure_rates)):
    ax.text(i - w/2, s + 1, f"{s:.0f}%", ha="center", va="bottom", fontsize=11, fontweight="bold")
    ax.text(i + w/2, f + 1, f"{f:.0f}%", ha="center", va="bottom", fontsize=11, fontweight="bold")

ax.set_xticks(x)
ax.set_xticklabels(strategies, fontsize=12)
ax.set_ylabel("Fleet Percentage (%)", fontsize=11)
ax.set_ylim(0, 115)
ax.set_title("Fleet Survival Rate\nDirect Deployment vs Canary Rollout (Fault Injection Test)", fontsize=12, fontweight="bold")
ax.legend(fontsize=10)
ax.grid(axis="y", alpha=0.3)
plt.tight_layout()
plt.savefig(os.path.join(REPORT_DIR, "fleet_survival_comparison.png"), dpi=150, bbox_inches="tight")
plt.close()
log("[INFO] Fleet survival chart saved -> reports/fleet_survival_comparison.png")

# ===============================================================================
# Save Report
# ===============================================================================
report_path = os.path.join(REPORT_DIR, "statistical_report.txt")
with open(report_path, "w", encoding="utf-8") as f:
    f.write("\n".join(report_lines))
print(f"\n[INFO] Full report saved -> {report_path}")
print("\n[SUCCESS] Statistical analysis complete!")
