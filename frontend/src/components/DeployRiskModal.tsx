"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Wifi,
  BatteryCharging,
  X,
  RefreshCw,
  Rocket,
  Layers,
} from "lucide-react";
import { FirmwareVersion } from "@/lib/types";

interface DeployRiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLaunching: boolean;
  firmware: FirmwareVersion | undefined;
  targetDevicesCount: number;
  targetScope: "all" | "factory" | "custom";
  selectedFactory?: string;
  strategy: "full" | "canary";
  rollbackThreshold: number;
}

export function DeployRiskModal({
  isOpen,
  onClose,
  onConfirm,
  isLaunching,
  firmware,
  targetDevicesCount,
  targetScope,
  selectedFactory,
  strategy,
  rollbackThreshold,
}: DeployRiskModalProps) {
  const [acknowledged, setAcknowledged] = useState<boolean>(false);

  if (!isOpen || !firmware) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleConfirm = () => {
    if (!acknowledged || isLaunching) return;
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-hairline-strong bg-surface-1 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-hairline flex items-center justify-between bg-surface-2/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-semantic-warning/10 text-semantic-warning border border-semantic-warning/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                Pre-Rollout Operational Risk Assessment
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  v{firmware.version}
                </span>
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">
                Review target specifications and industrial safety policies before dispatching firmware.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLaunching}
            className="text-ink-tertiary hover:text-ink p-1 rounded transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Target Summary Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-2/60 p-4 rounded-xl border border-hairline">
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-ink-tertiary">Target Version</p>
              <p className="font-mono font-bold text-ink text-sm mt-0.5">v{firmware.version}</p>
              <p className="text-[10px] text-ink-subtle mt-0.5">{formatBytes(firmware.file_size)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-ink-tertiary">Target Fleet</p>
              <p className="font-mono font-bold text-primary text-sm mt-0.5">{targetDevicesCount} Units</p>
              <p className="text-[10px] text-ink-subtle mt-0.5">
                {targetScope === "all" ? "All Online" : targetScope === "factory" ? selectedFactory : "Custom List"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-ink-tertiary">Strategy</p>
              <p className="font-mono font-bold text-ink text-sm mt-0.5 uppercase">{strategy}</p>
              <p className="text-[10px] text-ink-subtle mt-0.5">
                {strategy === "canary" ? "3 Phases (20% → 100%)" : "Direct Full Fleet"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-ink-tertiary">Abort Interlock</p>
              <p className="font-mono font-bold text-semantic-warning text-sm mt-0.5">{rollbackThreshold}%</p>
              <p className="text-[10px] text-ink-subtle mt-0.5">Auto-rollback on failure</p>
            </div>
          </div>

          {/* Operational Risk Badges */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted font-mono flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-semantic-warning" />
              Operational Impact & Risk Factors
            </h4>

            <div className="space-y-2.5">
              <div className="p-3.5 rounded-xl border border-hairline bg-surface-2/30 flex items-start gap-3">
                <Cpu className="w-4 h-4 text-semantic-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink">Robot Downtime & Flashing Reboot</p>
                  <p className="text-ink-subtle mt-0.5 leading-relaxed text-[11px]">
                    During firmware installation, target robots will suspend active navigation and task queues, write the binary into the secondary partition, and perform a hardware system restart.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-hairline bg-surface-2/30 flex items-start gap-3">
                <Wifi className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink">Network & Gateway Bandwidth Peak</p>
                  <p className="text-ink-subtle mt-0.5 leading-relaxed text-[11px]">
                    Concurrent payload downloads ({formatBytes(firmware.file_size)} per unit) may consume wireless access point bandwidth across factory access points.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-hairline bg-surface-2/30 flex items-start gap-3">
                <BatteryCharging className="w-4 h-4 text-semantic-success shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink">Pre-flight Battery Verification</p>
                  <p className="text-ink-subtle mt-0.5 leading-relaxed text-[11px]">
                    Robots with battery below 30% or in motion will queue until safely docked on charging pads to prevent flash corruption.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-hairline bg-surface-2/30 flex items-start gap-3">
                <ShieldAlert className="w-4 h-4 text-semantic-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink">Automated Fail-Safe Interlock</p>
                  <p className="text-ink-subtle mt-0.5 leading-relaxed text-[11px]">
                    If installation failure rate across units exceeds {rollbackThreshold}%, the cloud control plane will immediately abort deployment and command automatic rollback.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Cryptographic Verification Info */}
          <div className="p-3 rounded-lg bg-surface-2/80 border border-hairline flex items-center justify-between font-mono text-[11px]">
            <span className="text-ink-subtle">SHA256: {firmware.sha256_checksum.slice(0, 24)}...</span>
            <span className="text-semantic-success flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> ECDSA NIST P-256 Verified
            </span>
          </div>

          {/* Acknowledgment Checkbox */}
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-primary/30 bg-primary/5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="rounded bg-surface-2 border-hairline text-primary focus:ring-0 w-4 h-4 mt-0.5 cursor-pointer accent-primary"
            />
            <div className="text-xs leading-relaxed">
              <span className="font-medium text-ink">
                ข้าพเจ้ายืนยันการประเมินความเสี่ยงและอนุญาตให้เริ่มการ OTA Rollout ไปยังหุ่นยนต์เป้าหมาย
              </span>
              <p className="text-[11px] text-ink-subtle mt-0.5">
                I acknowledge the operational risks, downtime window, and authorize OTA rollout across {targetDevicesCount} online robots.
              </p>
            </div>
          </label>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-hairline bg-surface-2/30 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLaunching}
            className="px-4 py-2 text-xs font-medium rounded-lg text-ink-muted bg-surface-2 hover:bg-surface-3 border border-hairline transition-colors disabled:opacity-50"
          >
            Cancel / ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!acknowledged || isLaunching}
            className="flex items-center gap-2 px-5 py-2 text-xs font-medium rounded-lg bg-primary hover:bg-primary-hover active:bg-primary-focus text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
          >
            {isLaunching ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Authorizing & Broadcasting...
              </>
            ) : (
              <>
                <Rocket className="w-3.5 h-3.5" />
                Authorize & Launch Rollout
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
