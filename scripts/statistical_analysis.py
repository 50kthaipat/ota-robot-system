"""
statistical_analysis.py — Empirical Statistical Analysis & Plotting Suite
==============================================================================
Reads the real benchmark CSVs from data/experiments/
Produces descriptive statistics, Mann-Whitney U test, and high-DPI plots.
"""

import os
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "..", "data", "experiments")
REPORT_DIR = os.path.join(BASE_DIR, "..", "ml", "reports")
os.makedirs(REPORT_DIR, exist_ok=True)

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "axes.spines.top": False,
    "axes.spines.right": False,
    "figure.dpi": 300,
})

def log(msg):
    print(msg)
    with open(os.path.join(REPORT_DIR, "statistical_report.txt"), "a", encoding="utf-8") as f:
        f.write(msg + "\n")

if os.path.exists(os.path.join(REPORT_DIR, "statistical_report.txt")):
    os.remove(os.path.join(REPORT_DIR, "statistical_report.txt"))

log("==================================================================")
log(" ACADEMIC STATISTICAL REPORT (EMPIRICAL DATA)")
log("==================================================================")

# 1. Crypto Benchmark Analysis
sc1_file = os.path.join(DATA_DIR, "scenario_1_crypto_benchmark.csv")
if os.path.exists(sc1_file):
    df1 = pd.read_csv(sc1_file)
    log("\n[SCENARIO 1: Cryptographic Overhead]")
    desc = df1.groupby("file_size_mb")[["hash_time_us", "sig_verify_time_us", "throughput_mb_s"]].mean().round(2)
    log(desc.to_string())
    
    # Plot Hash vs Size
    plt.figure(figsize=(8,5))
    sns.lineplot(data=df1, x="file_size_mb", y="hash_time_us", marker="o", label="SHA-256 (O(N))")
    sns.lineplot(data=df1, x="file_size_mb", y="sig_verify_time_us", marker="s", label="ECDSA Verify (O(1))")
    plt.title("Cryptographic Overhead vs Payload Size")
    plt.xlabel("Firmware Size (MB)")
    plt.ylabel("Latency (Microseconds)")
    plt.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(REPORT_DIR, "crypto_overhead_scaling.png"))
    plt.close()

# 2. Security Rejection Analysis
sc2_file = os.path.join(DATA_DIR, "scenario_2_security_mitigation.csv")
if os.path.exists(sc2_file):
    df2 = pd.read_csv(sc2_file)
    log("\n[SCENARIO 2: Zero-Trust Security Rejection]")
    success_rate = df2["rejection_success"].mean() * 100
    log(f"Overall Rejection Success Rate: {success_rate:.2f}%")
    lat = df2.groupby("attack_type")["rejection_latency_ms"].agg(['mean', 'std']).round(3)
    log(lat.to_string())

# 3. Resilience A/B Test (Mann-Whitney U)
sc3_file = os.path.join(DATA_DIR, "scenario_3_resilience_ab.csv")
if os.path.exists(sc3_file):
    df3 = pd.read_csv(sc3_file)
    log("\n[SCENARIO 3: Fault Resilience A/B Test]")
    
    canary = df3[df3["strategy"] == "Canary_Phased_Rollout"]["fleet_survival_percent"]
    direct = df3[df3["strategy"] == "Direct_All_At_Once"]["fleet_survival_percent"]
    
    log(f"Canary Survival Mean: {canary.mean():.2f}%")
    log(f"Direct Survival Mean: {direct.mean():.2f}%")
    
    if len(canary) > 0 and len(direct) > 0:
        stat, p = stats.mannwhitneyu(canary, direct, alternative="greater")
        log(f"Mann-Whitney U Test (Canary > Direct): U={stat}, p-value={p:.4e}")
        if p < 0.05:
            log("Result: Statistically significant improvement in fleet survival (p < 0.05).")
            
    # Boxplot
    plt.figure(figsize=(7,5))
    sns.boxplot(data=df3, x="strategy", y="fleet_survival_percent", palette="Set2")
    plt.title("Fleet Survival Rate: Direct vs Canary Rollout")
    plt.ylabel("Survival Rate (%)")
    plt.tight_layout()
    plt.savefig(os.path.join(REPORT_DIR, "fleet_survival_comparison.png"))
    plt.close()

# 4. Network Stress Analysis
sc4_file = os.path.join(DATA_DIR, "scenario_4_network_stress.csv")
if os.path.exists(sc4_file):
    df4 = pd.read_csv(sc4_file)
    log("\n[SCENARIO 4: Network Stress & Transport Reliability]")
    net_desc = df4.groupby("network_profile")[["download_duration_ms", "effective_throughput_kbps", "retransmission_count"]].mean().round(2)
    log(net_desc.to_string())
    
    # CDF of download duration
    plt.figure(figsize=(8,5))
    sns.ecdfplot(data=df4, x="download_duration_ms", hue="network_profile")
    plt.title("CDF of 10MB Firmware Download Duration under Network Stress")
    plt.xlabel("Download Duration (ms)")
    plt.ylabel("Cumulative Probability")
    plt.tight_layout()
    plt.savefig(os.path.join(REPORT_DIR, "cdf_download_time.png"))
    plt.close()

# 5. Concurrency Scalability
sc5_file = os.path.join(DATA_DIR, "scenario_5_concurrency_scalability.csv")
if os.path.exists(sc5_file):
    df5 = pd.read_csv(sc5_file)
    log("\n[SCENARIO 5: Control Plane Concurrency]")
    conc_desc = df5.groupby("concurrent_nodes")[["requests_per_second", "p95_latency_ms", "server_cpu_percent"]].mean().round(2)
    log(conc_desc.to_string())
    
    plt.figure(figsize=(8,5))
    sns.lineplot(data=df5, x="concurrent_nodes", y="requests_per_second", marker="o", color="blue", label="RPS")
    plt.title("Control Plane Throughput (RPS) vs Concurrent Nodes")
    plt.xlabel("Virtual Nodes")
    plt.ylabel("Requests per Second (RPS)")
    plt.tight_layout()
    plt.savefig(os.path.join(REPORT_DIR, "concurrency_rps.png"))
    plt.close()

log("\n[OK] All statistical reports and figures generated successfully in ml/reports/")
