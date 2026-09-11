import os
import tarfile
import io
import struct
import random

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "firmware_samples"))
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate_bin_sample():
    filename = "firmware-v2.2.0-mcu-core.bin"
    filepath = os.path.join(OUTPUT_DIR, filename)
    target_size = 1024 * 1024  # 1 MB
    
    header = struct.pack("<IIII", 0x20010000, 0x08000101, 0x08000201, 0x08000301)
    metadata = b"ROBOT_FIRMWARE_PAYLOAD|NAME=mcu-core|VERSION=2.2.0|ARCH=ARM_CORTEX_M4|FPU=TRUE\n"
    
    payload = header + metadata
    remaining = target_size - len(payload)
    random.seed(220)
    payload += bytes(random.getrandbits(8) for _ in range(remaining))
    
    with open(filepath, "wb") as f:
        f.write(payload)
    print(f"[CREATED] {filename} ({len(payload)} bytes)")
    return filename

def generate_hex_sample():
    filename = "firmware-v1.3.0-bootloader.hex"
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    lines = []
    ext_addr = 0x0800
    ext_bytes = [0x02, 0x00, 0x00, 0x04, (ext_addr >> 8) & 0xFF, ext_addr & 0xFF]
    ext_chk = ((~sum(ext_bytes) + 1) & 0xFF)
    lines.append(f":02000004{ext_addr:04X}{ext_chk:02X}")
    
    random.seed(130)
    for i in range(5000):
        addr = (i * 16) & 0xFFFF
        if i > 0 and addr == 0:
            ext_addr += 1
            rec_bytes = [0x02, 0x00, 0x00, 0x04, (ext_addr >> 8) & 0xFF, ext_addr & 0xFF]
            c = ((~sum(rec_bytes) + 1) & 0xFF)
            lines.append(f":02000004{ext_addr:04X}{c:02X}")
            
        data = [random.randint(0, 255) for _ in range(16)]
        rec_bytes = [16, (addr >> 8) & 0xFF, addr & 0xFF, 0x00] + data
        chk = ((~sum(rec_bytes) + 1) & 0xFF)
        hex_data = "".join(f"{b:02X}" for b in data)
        lines.append(f":10{addr:04X}00{hex_data}{chk:02X}")
        
    lines.append(":00000001FF\n")
    
    with open(filepath, "w", encoding="ascii") as f:
        f.write("\n".join(lines))
    size = os.path.getsize(filepath)
    print(f"[CREATED] {filename} ({size} bytes, {len(lines)} records)")
    return filename

def generate_targz_sample():
    filename = "firmware-v4.0.0-ros2-app.tar.gz"
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    package_xml = b"""<?xml version="1.0"?>
<package format="3">
  <name>robot_autonomous_nav</name>
  <version>4.0.0</version>
  <description>Industrial Autonomous Mobile Robot Navigation Stack</description>
  <maintainer email="ota-core@robotics.internal">Fleet Admin</maintainer>
  <license>Proprietary</license>
  <depend>rclcpp</depend>
  <depend>nav2_core</depend>
</package>
"""
    config_yaml = b"""# ROS2 Navigation2 Configuration
controller_server:
  ros__parameters:
    use_sim_time: False
    controller_frequency: 20.0
    min_x_velocity_threshold: 0.001
    min_y_velocity_threshold: 0.5
    min_theta_velocity_threshold: 0.001
"""
    launch_py = b"""# ROS2 Launch File
from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        Node(
            package='robot_autonomous_nav',
            executable='nav_stack_node',
            name='navigation_engine',
            output='screen',
            parameters=['config/nav_params.yaml']
        )
    ])
"""
    manifest_json = b"""{
  "system": "OTA-Robot-System",
  "version": "4.0.0",
  "target_arch": "aarch64",
  "type": "ros2_application_bundle",
  "checksum_algorithm": "SHA-256",
  "dependencies": ["libssl3", "libyaml-cpp0.7"]
}
"""
    random.seed(400)
    mock_bin = b"\x7FELF\x02\x01\x01\x00" + bytes(random.getrandbits(8) for _ in range(2 * 1024 * 1024))
    
    with tarfile.open(filepath, "w:gz") as tar:
        def add_file(name, data, mode=0o644):
            ti = tarfile.TarInfo(name=name)
            ti.size = len(data)
            ti.mode = mode
            tar.addfile(ti, io.BytesIO(data))
            
        add_file("ros2_ws/package.xml", package_xml)
        add_file("ros2_ws/config/nav_params.yaml", config_yaml)
        add_file("ros2_ws/launch/robot_bringup.launch.py", launch_py)
        add_file("ros2_ws/manifest.json", manifest_json)
        add_file("ros2_ws/bin/nav_stack_node", mock_bin, mode=0o755)
        
    size = os.path.getsize(filepath)
    print(f"[CREATED] {filename} ({size} bytes)")
    return filename

def generate_img_sample():
    filename = "firmware-v4.1.0-system-rootfs.img"
    filepath = os.path.join(OUTPUT_DIR, filename)
    target_size = 4 * 1024 * 1024  # 4 MB
    
    data = bytearray(target_size)
    data[510] = 0x55
    data[511] = 0xAA
    data[1080] = 0x53
    data[1081] = 0xEF
    
    meta = b"ROBOT_SBC_ROOTFS_IMAGE|VERSION=4.1.0|SLOT=SLOT_B|DISTRO=Ubuntu-22.04-RT-Kernel"
    data[2048:2048+len(meta)] = meta
    
    random.seed(410)
    for i in range(4096, target_size, 4096):
        chunk = bytes(random.getrandbits(8) for _ in range(64))
        data[i:i+64] = chunk
        
    with open(filepath, "wb") as f:
        f.write(data)
    print(f"[CREATED] {filename} ({target_size} bytes)")
    return filename

if __name__ == "__main__":
    print("Generating comprehensive multi-format firmware samples...")
    generate_bin_sample()
    generate_hex_sample()
    generate_targz_sample()
    generate_img_sample()
    print("All multi-format firmware samples generated successfully!")
