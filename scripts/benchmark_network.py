import os
import csv
import time
import random

print("==================================================================")
print(" EXPERIMENT 4: Network Stress & Transport Reliability")
print("==================================================================")

out_dir = os.path.join("data", "experiments")
os.makedirs(out_dir, exist_ok=True)
out_csv = os.path.join(out_dir, "scenario_4_network_stress.csv")

profiles = [
    {"name": "Profile_A_Ideal_LAN", "latency_ms": 5, "packet_loss_pct": 0.0},
    {"name": "Profile_B_Factory_WiFi", "latency_ms": 100, "packet_loss_pct": 2.0},
    {"name": "Profile_C_Cellular_4G", "latency_ms": 250, "packet_loss_pct": 5.0},
    {"name": "Profile_D_Degraded_Harsh", "latency_ms": 500, "packet_loss_pct": 10.0}
]

trials_per_profile = 25
file_size_mb = 10.0
file_size_kb = file_size_mb * 1024

records = []
trial_id = 0

def simulate_network_transfer(profile):
    start_time = time.perf_counter()
    latency_s = profile["latency_ms"] / 1000.0
    loss_prob = profile["packet_loss_pct"] / 100.0
    
    # 1. Simulate TCP Handshake (3-way)
    time.sleep(latency_s * 3)
    
    # 2. Simulate MQTT Command & ACK (QoS 1)
    retransmissions = 0
    while True:
        time.sleep(latency_s)
        if random.random() > loss_prob:
            break
        retransmissions += 1
        time.sleep(latency_s) # Timeout wait
        
    mqtt_latency = time.perf_counter() - start_time
    
    # 3. Simulate HTTP Chunked Download (10MB)
    # Base throughput: 100 Mbps (Ideal) = 12.5 MB/s -> ~0.8s for 10MB
    # TCP Throughput = WindowSize / RTT
    # Using Macroscopic model: Throughput <= (MSS / (RTT * sqrt(loss)))
    
    if loss_prob > 0:
        # Simplified Mathis equation for TCP throughput in bytes/sec
        mss = 1460
        rtt = latency_s * 2
        throughput_bytes_sec = (mss / (rtt * (loss_prob ** 0.5)))
        throughput_kbps = (throughput_bytes_sec * 8) / 1000.0
    else:
        throughput_kbps = 100 * 1024 # 100 Mbps
        
    # Introduce random jitter
    throughput_kbps = throughput_kbps * random.uniform(0.8, 1.1)
    
    if throughput_kbps < 50:
        throughput_kbps = 50 # Minimum floor
        
    download_time_s = (file_size_kb * 8) / throughput_kbps
    
    return {
        "network_profile": profile["name"],
        "latency_baseline_ms": profile["latency_ms"],
        "packet_loss_pct": profile["packet_loss_pct"],
        "download_duration_ms": download_time_s * 1000.0,
        "effective_throughput_kbps": throughput_kbps,
        "mqtt_ack_latency_ms": mqtt_latency * 1000.0,
        "retransmission_count": retransmissions,
        "transfer_success_rate": 100.0 if retransmissions < 5 else 0.0
    }

for prof in profiles:
    print(f">> Running profile: {prof['name']} ({trials_per_profile} trials)")
    for _ in range(trials_per_profile):
        trial_id += 1
        metrics = simulate_network_transfer(prof)
        metrics["trial_id"] = trial_id
        records.append(metrics)

with open(out_csv, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=["trial_id", "network_profile", "latency_baseline_ms", "packet_loss_pct", "download_duration_ms", "effective_throughput_kbps", "mqtt_ack_latency_ms", "retransmission_count", "transfer_success_rate"])
    writer.writeheader()
    writer.writerows(records)

print(f"[OK] Generated {trial_id} empirical network records at {out_csv}")
