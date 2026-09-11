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
  targetVersion,
}: RollbackRiskModalProps) {
  const [acknowledged, setAcknowledged] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!acknowledged || isRollingBack) return;
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl border border-semantic-error/40 bg-surface-1 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-semantic-error/20 flex items-center justify-between bg-semantic-error/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-semantic-error/20 text-semantic-error border border-semantic-error/30">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                Emergency Fleet Rollback Authorization
              </h3>
              <p className="text-xs text-semantic-error mt-0.5">
                Critical high-risk operation: Involves immediate task termination and partition swapping.
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
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Target Summary Matrix */}
          <div className="grid grid-cols-2 gap-3 bg-surface-2/60 p-3.5 rounded-xl border border-hairline">
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-ink-tertiary">Deployment ID</p>
              <p className="font-mono font-bold text-ink text-xs mt-0.5 truncate">{deploymentId}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-ink-tertiary">Target Fleet Scope</p>
              <p className="font-mono font-bold text-semantic-error text-xs mt-0.5">
                {targetDevicesCount} Robot Units
              </p>
            </div>
          </div>

          {/* Rollback Risk Items */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-semantic-error font-mono flex items-center gap-2">
              <AlertOctagon className="w-3.5 h-3.5" />
              Critical Operational Hazards
            </h4>

            <div className="space-y-2.5">
              <div className="p-3.5 rounded-xl border border-semantic-error/20 bg-semantic-error/5 flex items-start gap-3">
                <StopCircle className="w-4 h-4 text-semantic-error shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink">Immediate Mission Abort</p>
                  <p className="text-ink-subtle mt-0.5 leading-relaxed text-[11px]">
                    Emergency rollback signal dispatches via MQTT broker. All targeted robots will immediately halt active operations, cancel navigation plans, and trigger safety stop.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-semantic-error/20 bg-semantic-error/5 flex items-start gap-3">
                <FileWarning className="w-4 h-4 text-semantic-warning shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink">Firmware Downgrade & Schema Incompatibility</p>
                  <p className="text-ink-subtle mt-0.5 leading-relaxed text-[11px]">
                    Reverting to previous firmware may cause configuration or state mismatch if database schemas, sensor calibrations, or CAN bus messages rely on newer formats.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-semantic-error/20 bg-semantic-error/5 flex items-start gap-3">
                <Cpu className="w-4 h-4 text-semantic-error shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink">Dual-Partition (A/B) Swapping & Hardware Reboot</p>
                  <p className="text-ink-subtle mt-0.5 leading-relaxed text-[11px]">
                    Robots will swap active boot partitions back to their previous stable slot and perform an unscheduled cold reboot.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Acknowledgment Checkbox */}
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-semantic-error/40 bg-semantic-error/10 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="rounded bg-surface-2 border-semantic-error text-semantic-error focus:ring-0 w-4 h-4 mt-0.5 cursor-pointer accent-semantic-error"
            />
            <div className="text-xs leading-relaxed">
              <span className="font-medium text-ink">
                ข้าพเจ้ายืนยันการสั่งการ Emergency Rollback ทันที
              </span>
              <p className="text-[11px] text-ink-subtle mt-0.5">
                I authorize immediate emergency rollback and acknowledge that all active robot missions will be terminated.
              </p>
            </div>
          </label>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-hairline bg-surface-2/30 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isRollingBack}
            className="px-4 py-2 text-xs font-medium rounded-lg text-ink-muted bg-surface-2 hover:bg-surface-3 border border-hairline transition-colors disabled:opacity-50"
          >
            Abort / ยกเลิกคำสั่ง
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!acknowledged || isRollingBack}
            className="flex items-center gap-2 px-5 py-2 text-xs font-medium rounded-lg bg-semantic-error hover:bg-semantic-error/90 active:bg-semantic-error/80 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
          >
            {isRollingBack ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Dispatching Rollback...
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                Execute Emergency Rollback
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
