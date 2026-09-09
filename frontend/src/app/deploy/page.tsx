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
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Rocket className="w-6 h-6 text-cyan-400" />
          Launch OTA Rollout
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Select target firmware, define deployment scope, and execute safe over-the-air updates.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Select Firmware */}
      <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-mono">1</span>
          Target Firmware Version
        </h3>

        {firmwares.length === 0 ? (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
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
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                      : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base text-white font-mono">v{fw.version}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 truncate">
                    {fw.release_notes || "Standard release"}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono mt-2">
                    SHA: {fw.sha256_checksum.slice(0, 12)}...
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 2: Target Scope */}
      <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-mono">2</span>
          Target Fleet Scope
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setTargetScope("all")}
            className={`p-4 rounded-xl border text-left transition ${
              targetScope === "all"
                ? "border-cyan-500 bg-cyan-500/10"
                : "border-slate-800 bg-slate-900/50 hover:border-slate-700 text-slate-400"
            }`}
          >
            <p className="text-xs font-bold text-white uppercase">All Online Units</p>
            <p className="text-xs text-slate-400 mt-1">Deploy to all {eligibleDevices.length} online robots</p>
          </button>

          <button
            type="button"
            onClick={() => setTargetScope("factory")}
            className={`p-4 rounded-xl border text-left transition ${
              targetScope === "factory"
                ? "border-cyan-500 bg-cyan-500/10"
                : "border-slate-800 bg-slate-900/50 hover:border-slate-700 text-slate-400"
            }`}
          >
            <p className="text-xs font-bold text-white uppercase">By Factory Group</p>
            <p className="text-xs text-slate-400 mt-1">Filter units by manufacturing facility</p>
          </button>

          <button
            type="button"
            onClick={() => setTargetScope("custom")}
            className={`p-4 rounded-xl border text-left transition ${
              targetScope === "custom"
                ? "border-cyan-500 bg-cyan-500/10"
                : "border-slate-800 bg-slate-900/50 hover:border-slate-700 text-slate-400"
            }`}
          >
            <p className="text-xs font-bold text-white uppercase">Manual Selection</p>
            <p className="text-xs text-slate-400 mt-1">Select individual robots from list</p>
          </button>
        </div>

        {/* Factory Dropdown */}
        {targetScope === "factory" && (
          <div className="pt-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">Select Factory Facility</label>
            <select
              value={selectedFactory}
              onChange={(e) => setSelectedFactory(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500 w-full sm:w-80"
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
              <span className="text-slate-400 font-medium">
                {selectedDeviceIds.length} of {eligibleDevices.length} robots selected
              </span>
              <button
                type="button"
                onClick={selectAllCustom}
                className="text-cyan-400 hover:text-cyan-300 transition"
              >
                {selectedDeviceIds.length === eligibleDevices.length ? "Deselect All" : "Select All Online"}
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-lg bg-slate-900/40">
              {eligibleDevices.map((d) => {
                const checked = selectedDeviceIds.includes(d.id);
                return (
                  <label
                    key={d.id}
                    className="flex items-center justify-between p-3 hover:bg-slate-800/40 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDeviceSelection(d.id)}
                        className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <div>
                        <p className="font-mono text-white font-semibold">{d.id}</p>
                        <p className="text-[11px] text-slate-400">{d.factory_id} • {d.hw_model}</p>
                      </div>
                    </div>
                    <span className="font-mono text-slate-400">Current: v{d.current_version}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Step 3: Strategy & Safety Controls */}
      <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-mono">3</span>
          Deployment Strategy & Safety Policies
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => setStrategy("full")}
            className={`p-4 rounded-xl border cursor-pointer transition ${
              strategy === "full"
                ? "border-cyan-500 bg-cyan-500/10"
                : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white">Direct / Full Fleet Rollout</span>
              {strategy === "full" && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Dispatches the update payload to all targeted units simultaneously. Ideal for rapid development and testing.
            </p>
          </div>

          <div
            onClick={() => setStrategy("canary")}
            className={`p-4 rounded-xl border cursor-pointer transition ${
              strategy === "canary"
                ? "border-cyan-500 bg-cyan-500/10"
                : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white">Canary Phased Rollout</span>
              {strategy === "canary" && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Progressively deploys across phases (Phase 1: 20% ➡️ Phase 2: 60% ➡️ Phase 3: 100%) with wait observation intervals.
            </p>
          </div>
        </div>

        {/* Safety Rollback Threshold */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Automated Emergency Rollback Threshold
            </span>
            <span className="font-mono text-cyan-400 font-bold">{rollbackThreshold}% Failures</span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={rollbackThreshold}
            onChange={(e) => setRollbackThreshold(Number(e.target.value))}
            className="w-full accent-cyan-500 cursor-pointer"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            If failure rate across units exceeds this threshold, rollout will immediately abort and command auto-rollback.
          </p>
        </div>
      </div>

      {/* Confirmation Bar */}
      <div className="glass-panel p-6 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 to-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-bold text-white flex items-center gap-2">
            Target: {selectedFw ? `v${selectedFw.version}` : "None"} ➡️ {targetDevices.length} Units
          </h4>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            Strategy: {strategy.toUpperCase()} • Max Failure Tolerance: {rollbackThreshold}%
          </p>
        </div>

        <button
          onClick={handleLaunch}
          disabled={isLaunching || targetDevices.length === 0 || !selectedFwId}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-xl shadow-cyan-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {isLaunching ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Broadcasting Rollout...
            </>
          ) : (
            <>
              <Rocket className="w-4 h-4" />
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
