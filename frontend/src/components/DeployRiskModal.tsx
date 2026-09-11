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
      <div className="w-full max-w-xl rounded-2xl border border-hairline-strong bg-surface-1 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-hairline flex items-center justify-between bg-surface-2/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-semantic-warning/10 text-semantic-warning border border-semantic-warning/20">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                Pre-Rollout Risk Assessment
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  v{firmware.version}
                </span>
              </h3>
              <p className="text-[11px] text-ink-subtle">
                Review operational risks before broadcasting firmware to fleet.
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

        {/* Content Body - Compact, No Vertical Scroll */}
        <div className="p-5 space-y-3.5 text-xs">
          {/* Target Specs 4-Col Grid */}
          <div className="grid grid-cols-4 gap-2.5 bg-surface-2/60 p-3 rounded-xl border border-hairline">
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-ink-tertiary">Version</p>
              <p className="font-mono font-bold text-ink text-xs mt-0.5">v{firmware.version}</p>
              <p className="text-[10px] text-ink-subtle">{formatBytes(firmware.file_size)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-ink-tertiary">Fleet Scope</p>
              <p className="font-mono font-bold text-primary text-xs mt-0.5">{targetDevicesCount} Units</p>
              <p className="text-[10px] text-ink-subtle truncate">
                {targetScope === "all" ? "All Online" : targetScope === "factory" ? selectedFactory : "Custom List"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-ink-tertiary">Strategy</p>
              <p className="font-mono font-bold text-ink text-xs mt-0.5 uppercase">{strategy}</p>
              <p className="text-[10px] text-ink-subtle">
                {strategy === "canary" ? "Phased 20-100%" : "Direct Full"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-ink-tertiary">Abort Limit</p>
              <p className="font-mono font-bold text-semantic-warning text-xs mt-0.5">{rollbackThreshold}%</p>
              <p className="text-[10px] text-ink-subtle">Auto-rollback</p>
            </div>
          </div>

          {/* Operational Risk Matrix - 2x2 Compact Grid */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted font-mono flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-semantic-warning" />
              Operational Impact & Hazards
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg border border-hairline bg-surface-2/40 flex items-start gap-2">
                <Cpu className="w-3.5 h-3.5 text-semantic-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-ink text-[11px]">Fleet Flashing & Reboot</p>
                  <p className="text-ink-subtle text-[10px] leading-tight mt-0.5">
                    Target units suspend tasks, flash secondary slot, and reboot.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-hairline bg-surface-2/40 flex items-start gap-2">
                <Wifi className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-ink text-[11px]">Network Bandwidth Peak</p>
                  <p className="text-ink-subtle text-[10px] leading-tight mt-0.5">
                    Parallel binary transfer across factory wireless access points.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-hairline bg-surface-2/40 flex items-start gap-2">
                <BatteryCharging className="w-3.5 h-3.5 text-semantic-success shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-ink text-[11px]">Battery Safety Interlock</p>
                  <p className="text-ink-subtle text-[10px] leading-tight mt-0.5">
                    Units below 30% hold until docked on charging station.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-hairline bg-surface-2/40 flex items-start gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-semantic-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-ink text-[11px]">Canary Auto-Abort</p>
                  <p className="text-ink-subtle text-[10px] leading-tight mt-0.5">
                    Rollout aborts if failure rate exceeds {rollbackThreshold}%.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Cryptographic Verification Badge */}
          <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-hairline flex items-center justify-between font-mono text-[10px]">
            <span className="text-ink-subtle">SHA256: {firmware.sha256_checksum.slice(0, 20)}...</span>
            <span className="text-semantic-success flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> NIST P-256 Signed
            </span>
          </div>

          {/* English Checkbox */}
          <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-primary/30 bg-primary/5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="rounded bg-surface-2 border-hairline text-primary focus:ring-0 w-4 h-4 cursor-pointer accent-primary shrink-0"
            />
            <span className="text-[11px] font-medium text-ink leading-tight">
              I understand the operational impact and authorize OTA rollout across {targetDevicesCount} robot units.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-hairline bg-surface-2/40 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLaunching}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-ink-muted bg-surface-2 hover:bg-surface-3 border border-hairline transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!acknowledged || isLaunching}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded-lg bg-primary hover:bg-primary-hover active:bg-primary-focus text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {isLaunching ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                Broadcasting...
              </>
            ) : (
              <>
                <Rocket className="w-3 h-3" />
                Authorize & Launch Rollout
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
