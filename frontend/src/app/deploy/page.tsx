"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Rocket,
  Layers,
  Bot,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  RefreshCw,
  Sliders,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import { Device, FirmwareVersion } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";

function DeployForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedFw = searchParams.get("firmware");
  const preselectedDevice = searchParams.get("device");

  const [firmwares, setFirmwares] = useState<FirmwareVersion[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedFwId, setSelectedFwId] = useState<string>("");
  const [targetScope, setTargetScope] = useState<"all" | "factory" | "custom">("all");
  const [selectedFactory, setSelectedFactory] = useState<string>("");
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<"full" | "canary">("full");
  const [rollbackThreshold, setRollbackThreshold] = useState<number>(20);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fwRes, devRes] = await Promise.all([api.getFirmwares(), api.getDevices()]);
        setFirmwares(fwRes.data || []);
        setDevices(devRes.data || []);

        if (preselectedFw && fwRes.data.some((f) => f.id === preselectedFw)) {
          setSelectedFwId(preselectedFw);
        } else if (fwRes.data.length > 0) {
          setSelectedFwId(fwRes.data[0].id);
        }

        if (preselectedDevice) {
          setTargetScope("custom");
          setSelectedDeviceIds([preselectedDevice]);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load initial configuration data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [preselectedFw, preselectedDevice]);

  const factories = useMemo(() => {
    const s = new Set<string>();
    devices.forEach((d) => s.add(d.factory_id));
    const arr = Array.from(s);
    if (arr.length > 0 && !selectedFactory) {
      setSelectedFactory(arr[0]);
    }
    return arr;
  }, [devices, selectedFactory]);

  const eligibleDevices = useMemo(() => {
    return devices.filter((d) => d.status === "online");
  }, [devices]);

  const targetDevices = useMemo(() => {
    if (targetScope === "all") {
      return eligibleDevices;
    }
    if (targetScope === "factory") {
      return eligibleDevices.filter((d) => d.factory_id === selectedFactory);
    }
    return eligibleDevices.filter((d) => selectedDeviceIds.includes(d.id));
  }, [targetScope, eligibleDevices, selectedFactory, selectedDeviceIds]);

  const selectedFw = useMemo(() => {
    return firmwares.find((f) => f.id === selectedFwId);
  }, [firmwares, selectedFwId]);

  const toggleDeviceSelection = (id: string) => {
    if (selectedDeviceIds.includes(id)) {
      setSelectedDeviceIds(selectedDeviceIds.filter((d) => d !== id));
    } else {
      setSelectedDeviceIds([...selectedDeviceIds, id]);
    }
  };

  const selectAllCustom = () => {
    if (selectedDeviceIds.length === eligibleDevices.length) {
      setSelectedDeviceIds([]);
    } else {
      setSelectedDeviceIds(eligibleDevices.map((d) => d.id));
    }
  };

  const handleLaunch = async () => {
    if (!selectedFwId) {
      setError("Please select a target firmware version.");
      return;
    }
    if (targetDevices.length === 0) {
      setError("No eligible online devices selected for deployment.");
      return;
    }

    setIsLaunching(true);
    setError(null);

    try {
      const payload = {
        firmware_id: selectedFwId,
        strategy: strategy,
        device_ids: targetScope === "all" ? undefined : targetDevices.map((d) => d.id),
        rollback_threshold: rollbackThreshold / 100,
      };

      const res = await api.createDeployment(payload);
      router.push(`/deployments/${res.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to trigger deployment.");
      setIsLaunching(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-400 mb-3" />
        Loading deployment launcher...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl w-full mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink flex items-center gap-2.5">
          <Rocket className="w-5 h-5 text-primary" />
          Launch OTA Rollout
        </h2>
        <p className="text-xs text-ink-subtle mt-1 tracking-wide">
          Select target firmware, define deployment scope, and execute safe over-the-air updates.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-semantic-error/10 border border-semantic-error/20 text-semantic-error text-xs flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Select Firmware */}
      <div className="bg-surface-1 p-6 rounded-xl border border-hairline space-y-4">
        <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-eyebrow flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-surface-2 text-primary border border-hairline text-[11px] font-mono">1</span>
          Target Firmware Version
        </h3>

        {firmwares.length === 0 ? (
          <div className="p-4 rounded-md bg-semantic-warning/10 border border-semantic-warning/20 text-semantic-warning text-xs">
            No firmware versions available. Please upload a firmware binary first in the{" "}
            <a href="/firmware" className="underline font-semibold">Firmware Catalog</a>.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {firmwares.map((fw) => {
              const isSelected = selectedFwId === fw.id;
              return (
                <div
                  key={fw.id}
                  onClick={() => setSelectedFwId(fw.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-hairline bg-surface-2/40 hover:border-hairline-strong hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-base text-ink font-mono">v{fw.version}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-xs text-ink-subtle mt-1 truncate">
                    {fw.release_notes || "Standard release"}
                  </p>
                  <p className="text-[10px] text-ink-tertiary font-mono mt-2">
                    SHA: {fw.sha256_checksum.slice(0, 12)}...
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 2: Target Scope */}
      <div className="bg-surface-1 p-6 rounded-xl border border-hairline space-y-4">
        <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-eyebrow flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-surface-2 text-primary border border-hairline text-[11px] font-mono">2</span>
          Target Fleet Scope
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setTargetScope("all")}
            className={`p-4 rounded-xl border text-left transition-colors ${
              targetScope === "all"
                ? "border-primary bg-primary/10"
                : "border-hairline bg-surface-2/40 hover:border-hairline-strong hover:bg-surface-2 text-ink-subtle"
            }`}
          >
            <p className="text-xs font-semibold text-ink uppercase tracking-wider">All Online Units</p>
            <p className="text-xs text-ink-subtle mt-1">Deploy to all {eligibleDevices.length} online robots</p>
          </button>

          <button
            type="button"
            onClick={() => setTargetScope("factory")}
            className={`p-4 rounded-xl border text-left transition-colors ${
              targetScope === "factory"
                ? "border-primary bg-primary/10"
                : "border-hairline bg-surface-2/40 hover:border-hairline-strong hover:bg-surface-2 text-ink-subtle"
            }`}
          >
            <p className="text-xs font-semibold text-ink uppercase tracking-wider">By Factory Group</p>
            <p className="text-xs text-ink-subtle mt-1">Filter units by manufacturing facility</p>
          </button>

          <button
            type="button"
            onClick={() => setTargetScope("custom")}
            className={`p-4 rounded-xl border text-left transition-colors ${
              targetScope === "custom"
                ? "border-primary bg-primary/10"
                : "border-hairline bg-surface-2/40 hover:border-hairline-strong hover:bg-surface-2 text-ink-subtle"
            }`}
          >
            <p className="text-xs font-semibold text-ink uppercase tracking-wider">Manual Selection</p>
            <p className="text-xs text-ink-subtle mt-1">Select individual robots from list</p>
          </button>
        </div>

        {/* Factory Dropdown */}
        {targetScope === "factory" && (
          <div className="pt-2">
            <label className="block text-xs font-medium text-ink-muted mb-1">Select Factory Facility</label>
            <select
              value={selectedFactory}
              onChange={(e) => setSelectedFactory(e.target.value)}
              className="px-3 py-2 text-xs rounded-md bg-surface-2 border border-hairline text-ink focus:outline-none focus:border-primary-focus w-full sm:w-80 transition-colors"
            >
              {factories.map((f) => (
                <option key={f} value={f}>
                  {f} ({devices.filter((d) => d.factory_id === f && d.status === "online").length} online units)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Custom Robot List */}
        {targetScope === "custom" && (
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-subtle font-medium">
                {selectedDeviceIds.length} of {eligibleDevices.length} robots selected
              </span>
              <button
                type="button"
                onClick={selectAllCustom}
                className="text-primary-hover hover:text-primary transition-colors font-medium"
              >
                {selectedDeviceIds.length === eligibleDevices.length ? "Deselect All" : "Select All Online"}
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-hairline border border-hairline rounded-lg bg-surface-2/40">
              {eligibleDevices.map((d) => {
                const checked = selectedDeviceIds.includes(d.id);
                return (
                  <label
                    key={d.id}
                    className="flex items-center justify-between p-3 hover:bg-surface-2/80 cursor-pointer text-xs transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDeviceSelection(d.id)}
                        className="rounded bg-surface-2 border-hairline text-primary focus:ring-0 w-4 h-4 cursor-pointer accent-primary"
                      />
                      <div>
                        <p className="font-mono text-ink font-semibold">{d.id}</p>
                        <p className="text-[11px] text-ink-subtle">{d.factory_id} • {d.hw_model}</p>
                      </div>
                    </div>
                    <span className="font-mono text-ink-subtle">Current: v{d.current_version}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Step 3: Strategy & Safety Controls */}
      <div className="bg-surface-1 p-6 rounded-xl border border-hairline space-y-4">
        <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-eyebrow flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-surface-2 text-primary border border-hairline text-[11px] font-mono">3</span>
          Deployment Strategy & Safety Policies
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => setStrategy("full")}
            className={`p-4 rounded-xl border cursor-pointer transition-colors ${
              strategy === "full"
                ? "border-primary bg-primary/10"
                : "border-hairline bg-surface-2/40 hover:border-hairline-strong hover:bg-surface-2"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-ink">Direct / Full Fleet Rollout</span>
              {strategy === "full" && <CheckCircle2 className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-xs text-ink-subtle mt-1 leading-relaxed">
              Dispatches the update payload to all targeted units simultaneously. Ideal for rapid development and testing.
            </p>
          </div>

          <div
            onClick={() => setStrategy("canary")}
            className={`p-4 rounded-xl border cursor-pointer transition-colors ${
              strategy === "canary"
                ? "border-primary bg-primary/10"
                : "border-hairline bg-surface-2/40 hover:border-hairline-strong hover:bg-surface-2"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-ink">Canary Phased Rollout</span>
              {strategy === "canary" && <CheckCircle2 className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-xs text-ink-subtle mt-1 leading-relaxed">
              Progressively deploys across phases (Phase 1: 20% → Phase 2: 60% → Phase 3: 100%) with wait observation intervals.
            </p>
          </div>
        </div>

        {/* Safety Rollback Threshold */}
        <div className="pt-3 border-t border-hairline">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-ink-muted font-medium flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-semantic-warning" />
              Automated Emergency Rollback Threshold
            </span>
            <span className="font-mono text-primary-hover font-semibold">{rollbackThreshold}% Failures</span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={rollbackThreshold}
            onChange={(e) => setRollbackThreshold(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />
          <p className="text-[11px] text-ink-tertiary mt-1">
            If failure rate across units exceeds this threshold, rollout will immediately abort and command auto-rollback.
          </p>
        </div>
      </div>

      {/* Confirmation Bar */}
      <div className="bg-surface-1 p-6 rounded-xl border border-hairline-strong flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-semibold text-ink flex items-center gap-2">
            Target: {selectedFw ? `v${selectedFw.version}` : "None"} → {targetDevices.length} Units
          </h4>
          <p className="text-xs text-ink-subtle mt-0.5 font-mono">
            Strategy: {strategy.toUpperCase()} • Max Failure Tolerance: {rollbackThreshold}%
          </p>
        </div>

        <button
          onClick={handleLaunch}
          disabled={isLaunching || targetDevices.length === 0 || !selectedFwId}
          className="flex items-center gap-2 px-5 py-2.5 rounded-md text-xs font-medium bg-primary hover:bg-primary-hover active:bg-primary-focus text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {isLaunching ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Broadcasting Rollout...
            </>
          ) : (
            <>
              <Rocket className="w-3.5 h-3.5" />
              Broadcast OTA Deployment
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function DeployPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400">Loading launcher...</div>}>
      <DeployForm />
    </Suspense>
  );
}
