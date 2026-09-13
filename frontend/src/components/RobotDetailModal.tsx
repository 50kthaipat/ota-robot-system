"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import {
  X,
  Bot,
  Radio,
  Wifi,
  Battery,
  BatteryCharging,
  BatteryWarning,
  ShieldCheck,
  Activity,
  HardDrive,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Rocket,
  Lock,
  PlayCircle,
  PauseCircle,
  Trash2,
} from "lucide-react";
import { Device, parseDeviceTelemetry, getErrorMessage } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { api } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

interface RobotDetailModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}

export const RobotDetailModal: React.FC<RobotDetailModalProps> = ({
  device,
  isOpen,
  onClose,
  onDeleted,
}) => {
  const { showToast } = useToast();
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(isOpen, dialogRef, closeRef, onClose, isDeleting);

  const handleDeleteDevice = async () => {
    if (!device) return;
    setIsDeleting(true);
    try {
      await api.deleteDevice(device.id);
      showToast(
        "Robot Decommissioned",
        `Robot node ${device.name || device.id} removed from fleet registry`,
        "success"
      );
      setConfirmDelete(false);
      onDeleted?.();
      onClose();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to decommission robot");
      showToast("Decommission Failed", msg, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !device) return null;

  const telemetry = parseDeviceTelemetry(device.metadata);
  const isOnline = device.status === "online";
  const isUpdating = device.status === "updating";
  const isAGV =
    device.hw_model.toLowerCase().includes("agv") ||
    device.id.toLowerCase().includes("agv") ||
    device.name.toLowerCase().includes("agv");

  // Telemetry attributes - ONLY read live battery if the robot is online
  const rawBattery = telemetry?.battery_level;
  const batteryLevel = isOnline && typeof rawBattery === "number" ? rawBattery : null;
  const isCharging = isOnline && (telemetry?.is_charging ?? false);

  // Network & Bandwidth
  const networkRssi = telemetry?.network_rssi ?? (isOnline ? -60 : -99);
  const networkBandwidth =
    telemetry?.network_bandwidth ||
    (isOnline
      ? isAGV
        ? "54 Mbps (Wi-Fi 802.11ac)"
        : "100 Mbps (Gigabit Ethernet)"
      : "Disconnected (0 bps)");

  // Workload & Task Execution State (IDLE vs BUSY)
  const activity = telemetry?.activity || (isOnline ? "idle" : "offline");
  const isBusy = isOnline && (activity === "running_program" || activity === "operating");
  const isIdle = isOnline && !isBusy && !isUpdating;

  // Pre-flight OTA Eligibility Check
  const batteryOk = !isAGV || (batteryLevel !== null && batteryLevel >= 50);
  const canDeploy = isOnline && isIdle && !isUpdating && batteryOk;

  const getSignalStrength = (rssi: number) => {
    if (!isOnline) return { label: "Offline", color: "text-ink-tertiary" };
    if (rssi >= -60) return { label: "Excellent", color: "text-semantic-success" };
    if (rssi >= -70) return { label: "Good", color: "text-primary" };
    if (rssi >= -80) return { label: "Fair", color: "text-semantic-warning" };
    return { label: "Weak", color: "text-semantic-error" };
  };

  const signal = getSignalStrength(networkRssi);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm motion-safe:animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="robot-detail-title"
        aria-describedby="robot-detail-description"
        tabIndex={-1}
        className="w-full max-w-xl bg-surface-1 border border-hairline rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-hairline flex items-center justify-between bg-surface-2/40">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-primary/15 border border-primary/25 text-primary">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="robot-detail-title" className="text-sm font-semibold text-ink font-mono tracking-tight">
                  {device.name || device.id}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-3 border border-hairline font-mono text-ink-muted uppercase">
                  {device.hw_model}
                </span>
              </div>
              <p id="robot-detail-description" className="text-xs text-ink-tertiary font-sans mt-0.5">
                Node identity and live telemetry stream
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={device.status} />
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close robot details"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-tertiary hover:text-ink hover:bg-surface-2 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Section 1: Robot Task Execution & Workload Status (IDLE vs BUSY) */}
          <div className="p-4 rounded-xl bg-surface-2/70 border border-hairline space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink font-mono uppercase tracking-wider">
                <Activity className="w-4 h-4 text-primary" />
                Robot Execution Status (Workload)
              </div>
              <span
                className={`text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                  !isOnline
                    ? "bg-surface-3 border-hairline text-ink-tertiary"
                    : isBusy
                    ? "bg-semantic-warning/15 border-semantic-warning/30 text-semantic-warning motion-safe:animate-pulse"
                    : "bg-semantic-success/15 border-semantic-success/30 text-semantic-success"
                }`}
              >
                {!isOnline
                  ? "OFFLINE"
                  : isBusy
                  ? "RUNNING PROGRAM (BUSY)"
                  : "IDLE (STANDBY)"}
              </span>
            </div>

            {/* Status Details */}
            <div className="grid grid-cols-1 gap-3 text-xs pt-1 sm:grid-cols-2">
              <div className="p-2.5 rounded-lg bg-surface-1 border border-hairline/80 space-y-1">
                <span className="text-xs font-mono text-ink-tertiary uppercase block">
                  Active Task / Cycle
                </span>
                <div className="flex items-center gap-1.5 font-mono font-medium text-ink">
                  {!isOnline ? (
                    <span className="text-ink-muted text-xs">No connection</span>
                  ) : isBusy ? (
                    <>
                      <PlayCircle className="w-3.5 h-3.5 text-semantic-warning shrink-0" />
                      <span className="truncate text-semantic-warning">Cycle in progress</span>
                    </>
                  ) : (
                    <>
                      <PauseCircle className="w-3.5 h-3.5 text-semantic-success shrink-0" />
                      <span className="text-ink text-xs">None (Standby)</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-surface-1 border border-hairline/80 space-y-1">
                <span className="text-xs font-mono text-ink-tertiary uppercase block">
                  OTA Upgrade Safety Gate
                </span>
                <div className="font-mono font-medium text-xs flex items-center gap-1.5">
                  {!isOnline ? (
                    <span className="text-semantic-error">Blocked (Offline)</span>
                  ) : isBusy ? (
                    <span className="text-semantic-error">Locked (Program Running)</span>
                  ) : !batteryOk ? (
                    <span className="text-semantic-warning">Locked (Low Battery)</span>
                  ) : (
                    <span className="text-semantic-success">Cleared (Safe to Upgrade)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Pre-flight Explanation Alert */}
            <div
              className={`p-2.5 rounded-lg text-xs leading-relaxed flex items-start gap-2 border ${
                canDeploy
                  ? "bg-semantic-success/10 border-semantic-success/20 text-semantic-success"
                  : isBusy
                  ? "bg-semantic-warning/10 border-semantic-warning/25 text-semantic-warning"
                  : "bg-surface-3/80 border-hairline text-ink-muted"
              }`}
            >
              {canDeploy ? (
                <>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    OTA Pre-flight Cleared: Robot is in IDLE standby mode with no active program running. Firmware deployment is safe to proceed.
                  </span>
                </>
              ) : isBusy ? (
                <>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Safety Interlock Engaged: Robot is currently executing an active cycle. The robot must be in IDLE state before applying firmware updates to prevent production disruption.
                  </span>
                </>
              ) : !isOnline ? (
                <>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-semantic-error" />
                  <span className="text-semantic-error">
                    OTA Unreachable: Robot controller is disconnected from the MQTT broker.
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-semantic-warning" />
                  <span>
                    OTA Safety Gate: AGV battery is below the 50% safety margin. Connect to a charging dock before dispatching firmware.
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Section 2: Conditional AGV Battery Card (Only for AGV) */}
          {isAGV && (
            <div className="p-4 rounded-xl bg-surface-2/70 border border-hairline space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-ink font-mono uppercase tracking-wider">
                  {!isOnline ? (
                    <Battery className="w-4 h-4 text-ink-tertiary" />
                  ) : isCharging ? (
                    <BatteryCharging className="w-4 h-4 text-semantic-success motion-safe:animate-pulse" />
                  ) : batteryLevel !== null && batteryLevel < 25 ? (
                    <BatteryWarning className="w-4 h-4 text-semantic-error" />
                  ) : (
                    <Battery className="w-4 h-4 text-semantic-success" />
                  )}
                  AGV Power Subsystem (Lithium-Ion)
                </div>
                <span
                  className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full border ${
                    !isOnline
                      ? "bg-surface-3 border-hairline text-ink-tertiary"
                      : isCharging
                      ? "bg-semantic-success/10 border-semantic-success/30 text-semantic-success"
                      : "bg-surface-3 border-hairline text-ink-muted"
                  }`}
                >
                  {!isOnline
                    ? "Offline (No Signal)"
                    : isCharging
                    ? "Charging via Dock"
                    : "Discharging (On Battery)"}
                </span>
              </div>

              {/* Battery Progress Bar */}
              {isOnline && batteryLevel !== null ? (
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-xs font-mono">
                    <span className="text-ink-tertiary text-xs">State of Charge (SoC)</span>
                    <span className="text-sm font-bold text-ink">{batteryLevel}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-surface-3 overflow-hidden p-0.5 border border-hairline">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${
                        batteryLevel >= 60
                          ? "bg-semantic-success"
                          : batteryLevel >= 25
                          ? "bg-semantic-warning"
                          : "bg-semantic-error"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, batteryLevel))}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-surface-1 border border-hairline text-center text-xs text-ink-tertiary font-mono">
                  Battery telemetry unavailable while robot is offline.
                </div>
              )}
            </div>
          )}

          {/* Section 3: Technical Specifications & Location Grid */}
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div className="p-3 rounded-xl bg-surface-2/40 border border-hairline space-y-1">
              <span className="text-xs font-mono text-ink-tertiary uppercase tracking-wider block">
                Factory Location
              </span>
              <p className="font-mono font-medium text-ink truncate">{device.factory_id}</p>
            </div>

            <div className="p-3 rounded-xl bg-surface-2/40 border border-hairline space-y-1">
              <span className="text-xs font-mono text-ink-tertiary uppercase tracking-wider block">
                Hardware Architecture
              </span>
              <p className="font-mono font-medium text-ink truncate">{device.hw_model}</p>
            </div>

            <div className="p-3 rounded-xl bg-surface-2/40 border border-hairline space-y-1">
              <span className="text-xs font-mono text-ink-tertiary uppercase tracking-wider block">
                Network Bandwidth
              </span>
              <div className="flex items-center gap-1.5 font-mono font-medium text-ink">
                <Radio className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{networkBandwidth}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-2/40 border border-hairline space-y-1">
              <span className="text-xs font-mono text-ink-tertiary uppercase tracking-wider block">
                Wi-Fi Signal Strength
              </span>
              <div className="flex items-center gap-1.5 font-mono font-medium text-ink">
                <Wifi className={`w-3.5 h-3.5 ${signal.color} shrink-0`} />
                <span>
                  {isOnline ? `${networkRssi} dBm (${signal.label})` : "Disconnected"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Firmware & OTA Security Specs */}
          <div className="p-3.5 rounded-xl bg-surface-2/40 border border-hairline space-y-2.5">
            <div className="flex items-center justify-between border-b border-hairline/60 pb-2">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-ink">
                <HardDrive className="w-3.5 h-3.5 text-primary" />
                Active Firmware
              </div>
              <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                v{device.current_version}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs text-ink-subtle pt-0.5 sm:grid-cols-2">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-ink-tertiary" />
                <span>Partition: A/B Dual Slot</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-semantic-success" />
                <span>Security: ECDSA P-256</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2">
                <Calendar className="w-3 h-3 text-ink-tertiary" />
                <span>
                  Last Heartbeat:{" "}
                  {device.last_seen
                    ? new Date(device.last_seen).toLocaleTimeString()
                    : "No record"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-hairline bg-surface-2/30 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 px-4 py-2 rounded-lg text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-3 transition-colors border border-hairline"
            >
              Close
            </button>

            {!isOnline && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-semantic-error font-mono font-medium">Decommission node?</span>
                  <button
                    type="button"
                    onClick={handleDeleteDevice}
                    disabled={isDeleting}
                    className="min-h-11 px-3 py-1.5 rounded-lg bg-semantic-error-strong hover:bg-semantic-error-strong/90 text-white text-xs font-medium transition-colors"
                  >
                    {isDeleting ? "Removing..." : "Yes, Remove"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="min-h-11 px-2.5 py-1.5 rounded-lg bg-surface-3 hover:bg-surface-2 text-ink-muted text-xs transition border border-hairline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="min-h-11 px-3 py-1.5 rounded-lg bg-semantic-error/10 hover:bg-semantic-error/20 text-semantic-error border border-semantic-error/25 text-xs font-medium flex items-center gap-1.5 transition"
                  title="Remove decommissioned offline unit from fleet"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Decommission Unit
                </button>
              )
            )}
          </div>

          {canDeploy ? (
            <Link
              href={`/deploy?device=${encodeURIComponent(device.id)}`}
              onClick={onClose}
              className="min-h-11 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-surface-1 text-xs font-medium flex items-center justify-center gap-2 shadow-md transition-colors"
            >
              <Rocket className="w-3.5 h-3.5" />
              Launch Rollout to this Robot →
            </Link>
          ) : (
            <button
              disabled
              className="min-h-11 px-4 py-2 rounded-lg bg-surface-3 text-ink-tertiary text-xs font-medium flex items-center justify-center gap-2 border border-hairline cursor-not-allowed opacity-75"
              title={
                !isOnline
                  ? "Robot is offline"
                  : isBusy
                  ? "Robot is running a program. Must be in IDLE state before upgrading."
                  : "Battery level is below 50%"
              }
            >
              <Lock className="w-3.5 h-3.5 text-ink-tertiary" />
              {!isOnline
                ? "OTA Blocked (Offline)"
                : isBusy
                ? "OTA Locked (Robot Busy)"
                : "OTA Blocked (Battery < 50%)"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
