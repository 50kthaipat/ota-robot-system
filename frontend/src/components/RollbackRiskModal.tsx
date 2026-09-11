"use client";

import React, { useState } from "react";
import {
  AlertOctagon,
  RotateCcw,
  X,
  RefreshCw,
  Cpu,
  StopCircle,
  FileWarning,
} from "lucide-react";

interface RollbackRiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isRollingBack: boolean;
  deploymentId: string;
  targetDevicesCount: number;
  targetVersion?: string;
}

export function RollbackRiskModal({
  isOpen,
  onClose,
  onConfirm,
  isRollingBack,
  deploymentId,
  targetDevicesCount,
}: RollbackRiskModalProps) {
  const [acknowledged, setAcknowledged] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!acknowledged || isRollingBack) return;
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-semantic-error/40 bg-surface-1 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-semantic-error/20 flex items-center justify-between bg-semantic-error/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-semantic-error/20 text-semantic-error border border-semantic-error/30">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                Emergency Fleet Rollback
              </h3>
              <p className="text-[11px] text-semantic-error">
                Critical Operation: Revert all target robots to previous firmware.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRollingBack}
            className="text-ink-tertiary hover:text-ink p-1 rounded transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-3.5 text-xs">
          {/* Target Summary */}
          <div className="grid grid-cols-2 gap-2.5 bg-surface-2/60 p-2.5 rounded-xl border border-hairline">
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-ink-tertiary">Deployment ID</p>
              <p className="font-mono font-bold text-ink text-xs mt-0.5 truncate">{deploymentId}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-ink-tertiary">Affected Fleet</p>
              <p className="font-mono font-bold text-semantic-error text-xs mt-0.5">
                {targetDevicesCount} Robot Units
              </p>
            </div>
          </div>

          {/* Rollback Hazards */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-semantic-error font-mono flex items-center gap-1.5">
              <AlertOctagon className="w-3 h-3" />
              Critical Operational Hazards
            </p>

            <div className="space-y-2">
              <div className="p-2.5 rounded-lg border border-semantic-error/20 bg-semantic-error/5 flex items-start gap-2.5">
                <StopCircle className="w-3.5 h-3.5 text-semantic-error shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink text-[11px]">Immediate Mission Abort</p>
                  <p className="text-ink-subtle text-[10px] leading-relaxed mt-0.5">
                    Emergency stop signal dispatched via MQTT. Active navigation, pathing, and manipulator tasks halt immediately.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-semantic-error/20 bg-semantic-error/5 flex items-start gap-2.5">
                <FileWarning className="w-3.5 h-3.5 text-semantic-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink text-[11px]">Version Downgrade & Schema Regression</p>
                  <p className="text-ink-subtle text-[10px] leading-relaxed mt-0.5">
                    Reverting to earlier firmware may reset configurations or cause protocol mismatches with newer sensors.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-semantic-error/20 bg-semantic-error/5 flex items-start gap-2.5">
                <Cpu className="w-3.5 h-3.5 text-semantic-error shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink text-[11px]">Dual-Partition (A/B) Swap & Hardware Reboot</p>
                  <p className="text-ink-subtle text-[10px] leading-relaxed mt-0.5">
                    Robot controllers swap active boot slots back to previous stable image and initiate a hardware restart.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Checkbox */}
          <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-semantic-error/40 bg-semantic-error/10 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="rounded bg-surface-2 border-semantic-error text-semantic-error focus:ring-0 w-4 h-4 cursor-pointer accent-semantic-error shrink-0"
            />
            <span className="text-[11px] font-medium text-ink leading-tight">
              I understand the risks and authorize immediate emergency fleet rollback.
            </span>
          </label>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-hairline bg-surface-2/40 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isRollingBack}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-ink-muted bg-surface-2 hover:bg-surface-3 border border-hairline transition-colors disabled:opacity-50"
          >
            Keep Current (Cancel)
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!acknowledged || isRollingBack}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded-lg bg-semantic-error hover:bg-semantic-error/90 active:bg-semantic-error/80 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {isRollingBack ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                Dispatching Rollback...
              </>
            ) : (
              <>
                <RotateCcw className="w-3 h-3" />
                Confirm Emergency Rollback
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
