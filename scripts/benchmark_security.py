import os
import time
import csv
import json
import random
from datetime import datetime
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes
from cryptography.exceptions import InvalidSignature

print("==================================================================")
print(" EXPERIMENT 2: Zero-Trust Security Threat Mitigation")
print("==================================================================")

# Generate genuine keys
private_key = ec.generate_private_key(ec.SECP256R1())
public_key = private_key.public_key()

# Generate rogue keys
rogue_private_key = ec.generate_private_key(ec.SECP256R1())

# Create output dir
out_dir = os.path.join("data", "experiments")
os.makedirs(out_dir, exist_ok=True)
out_csv = os.path.join(out_dir, "scenario_2_security_mitigation.csv")

scenarios = [
    "unsigned_binary",
    "single_bitflip",
    "forged_signature",
    "hardware_mismatch",
    "malformed_header"
]
trials_per_scenario = 20
total_trials = len(scenarios) * trials_per_scenario

records = []
trial_id = 0

def create_payload(attack_type):
    payload = b"FIRMWARE_BINARY_DATA_MOCK_" * 1024 * 10  # ~260KB payload
    
    # 1. Hardware mismatch
    hw_model = "scara-v1"
    if attack_type == "hardware_mismatch":
        hw_model = "delta-v2"  # Mismatch for a scara target
        
    # 2. Malformed Header
    if attack_type == "malformed_header":
        header = b"{ invalid_json"
    else:
        header = json.dumps({"hw_model": hw_model, "version": "v2.0.0"}).encode('utf-8')
        
    # 3. Bitflip
    if attack_type == "single_bitflip":
        # Mutate payload
        mutable = bytearray(payload)
        mutable[500] = mutable[500] ^ 1
        tampered_payload = bytes(mutable)
    else:
        tampered_payload = payload
        
    # 4. Signatures
    digest = hashes.Hash(hashes.SHA256())
    digest.update(payload)
    original_hash = digest.finalize()
    
    if attack_type == "unsigned_binary":
        signature = None
    elif attack_type == "forged_signature":
        signature = rogue_private_key.sign(original_hash, ec.ECDSA(hashes.SHA256()))
    else:
        signature = private_key.sign(original_hash, ec.ECDSA(hashes.SHA256()))
        
    return header, tampered_payload, signature, original_hash

# Edge Validation Pipeline
def edge_validate(header_bytes, payload_bytes, signature_bytes, original_hash, expected_hw="scara-v1"):
    start_time = time.perf_counter_ns()
    
    # 1. Header Validation
    try:
        header = json.loads(header_bytes)
        if header.get("hw_model") != expected_hw:
            elapsed = time.perf_counter_ns() - start_time
            return "HEADER_VALIDATION", False, "HARDWARE_MISMATCH", elapsed
    except Exception:
        elapsed = time.perf_counter_ns() - start_time
        return "HEADER_VALIDATION", False, "MALFORMED_HEADER", elapsed
        
    # 2. Hash Verification
    digest = hashes.Hash(hashes.SHA256())
    digest.update(payload_bytes)
    computed_hash = digest.finalize()
    
    if computed_hash != original_hash:
        elapsed = time.perf_counter_ns() - start_time
        return "HASH_VERIFICATION", False, "HASH_MISMATCH", elapsed
        
    # 3. Signature Verification
    if signature_bytes is None:
        elapsed = time.perf_counter_ns() - start_time
        return "SIGNATURE_VERIFICATION", False, "MISSING_SIGNATURE", elapsed
        
    try:
        public_key.verify(signature_bytes, computed_hash, ec.ECDSA(hashes.SHA256()))
    except InvalidSignature:
        elapsed = time.perf_counter_ns() - start_time
        return "SIGNATURE_VERIFICATION", False, "INVALID_SIGNATURE", elapsed
        
    elapsed = time.perf_counter_ns() - start_time
    return "SUCCESS", True, "NONE", elapsed

for attack in scenarios:
    print(f">> Running attack vector: {attack} ({trials_per_scenario} trials)")
    for _ in range(trials_per_scenario):
        trial_id += 1
        
        # Prepare mock payload based on attack
        header, payload, sig, orig_hash = create_payload(attack)
        
        # Execute Edge Pipeline
        stage, passed, reason, elapsed_ns = edge_validate(header, payload, sig, orig_hash)
        
        elapsed_ms = elapsed_ns / 1_000_000.0
        
        # In this experiment, ALL attacks should be rejected.
        is_rejected = not passed
        
        records.append({
            "trial_id": trial_id,
            "attack_type": attack,
            "detection_stage": stage,
            "rejection_success": is_rejected,
            "rejection_latency_ms": round(elapsed_ms, 4),
            "error_code": reason
        })

with open(out_csv, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=["trial_id", "attack_type", "detection_stage", "rejection_success", "rejection_latency_ms", "error_code"])
    writer.writeheader()
    writer.writerows(records)

print(f"[OK] Generated {total_trials} empirical security records at {out_csv}")
