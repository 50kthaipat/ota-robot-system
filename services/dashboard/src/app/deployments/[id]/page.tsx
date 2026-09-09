"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Bot,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  RotateCcw,
  Clock,
  Layers,
  Check,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { Deployment, DeploymentDevice } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";

export default function DeploymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [devices, setDevices] = useState<DeploymentDevice[]>([]);
  const [targetVersion, setTargetVersion] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [isRollingBack, setIsRollingBack] = useState<boolean>(false);
  const [rollbackMsg, setRollbackMsg] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    try {
      const res = await api.getDeployment(id);
      setDeployment(res.deployment);
      setDevices(res.devices || []);
      if (res.target_version) {
        setTargetVersion(res.target_version);
      }
    } catch (err) {
      console.error("Failed to load deployment details", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      loadData();
    }, 2000);
    return () => clearInterval(timer);
  }, [id]);

  const handleRollback = async () => {
    if (!confirm("Are you sure you want to trigger an EMERGENCY ROLLBACK? This will command all target units to revert to their previous firmware.")) {
      return;
    }
    setIsRollingBack(true);
    try {
      await api.rollbackDeployment(id);
      setRollbackMsg("Rollback command dispatched to all fleet units!");
      await loadData();
    } catch (err: any) {
      alert("Rollback failed: " + (err.message || "Unknown error"));
    } finally {
      setIsRollingBack(false);
    }
  };

  if (loading && !deployment) {
    return (
      <div className="p-12 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-400 mb-3" />
        Connecting to rollout telemetry stream...
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="p-12 text-center text-slate-400">
        <AlertOctagon className="w-8 h-8 mx-auto text-rose-400 mb-3" />
        Deployment not found or database unreachable.
        <div className="mt-4">
          <Link href="/deployments" className="text-cyan-400 hover:underline text-xs">
            Back to Rollout History
          </Link>
        </div>
      </div>
    );
  }

  const completedCount = deployment.success_count + deployment.failure_count;
  const progressPercent =
    deployment.total_devices > 0
      ? Math.round((completedCount / deployment.total_devices) * 100)
      : 0;

  return (
    <div className="p-8 max-w-6xl w-full mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/deployments"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Rollout Deployments
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-cyan-400" />
              Live Deployment Monitor
            </h2>
            <StatusBadge status={deployment.status} />
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              ECDSA P-256 Signed
            </div>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">ID: {deployment.id}</p>
        </div>

        {deployment.status !== "rolled_back" && (
          <button
            onClick={handleRollback}
            disabled={isRollingBack}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-lg shadow-rose-500/10 transition disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${isRollingBack ? "animate-spin" : ""}`} />
            {isRollingBack ? "Aborting & Rolling Back..." : "Trigger Emergency Rollback"}
          </button>
        )}
      </div>

      {deployment.status === "rolled_back" && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3 shadow-lg shadow-rose-500/5">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-white uppercase tracking-wider block">
                {deployment.failure_count / Math.max(1, deployment.total_devices) >= deployment.rollback_threshold
                  ? "Automated Safety Rollback Triggered"
                  : "Manual Emergency Rollback Dispatched"}
              </span>
              <span className="text-slate-300 text-[11px]">
                Failure rate exceeded safety threshold ({Math.round(deployment.rollback_threshold * 100)}%). All fleet nodes have been commanded via MQTT to restore their previous stable firmware version.
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold uppercase border border-rose-500/40">
            Automated Interlock
          </span>
        </div>
      )}

      {deployment.strategy === "canary" && (
        <div className="glass-panel p-5 rounded-xl border border-cyan-500/20 bg-cyan-950/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Canary Phased Rollout Schedule
              </span>
            </div>
            <span className="text-xs font-mono text-cyan-400 font-bold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
              Active Phase: {deployment.current_phase || 1} ({deployment.canary_percentage || 20}% Fleet)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <div
              className={`p-3 rounded-lg border transition ${
                (deployment.current_phase || 1) >= 1
                  ? "bg-cyan-500/10 border-cyan-500/40 text-white shadow-sm shadow-cyan-500/20"
                  : "bg-slate-900/40 border-slate-800 text-slate-500"
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold uppercase">Phase 1: Canary</span>
                <span className="font-mono text-cyan-400 font-bold">20%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Initial 1 robot node telemetry observation</p>
            </div>

            <div
              className={`p-3 rounded-lg border transition ${
                (deployment.current_phase || 1) >= 2
                  ? "bg-cyan-500/10 border-cyan-500/40 text-white shadow-sm shadow-cyan-500/20"
                  : "bg-slate-900/40 border-slate-800 text-slate-500"
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold uppercase">Phase 2: Expanded</span>
                <span className="font-mono text-cyan-400 font-bold">60%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Multi-factory telemetry validation</p>
            </div>

            <div
              className={`p-3 rounded-lg border transition ${
                (deployment.current_phase || 1) >= 3
                  ? "bg-cyan-500/10 border-cyan-500/40 text-white shadow-sm shadow-cyan-500/20"
                  : "bg-slate-900/40 border-slate-800 text-slate-500"
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold uppercase">Phase 3: Full Fleet</span>
                <span className="font-mono text-cyan-400 font-bold">100%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Total distributed fleet upgrade</p>
            </div>
          </div>
        </div>
      )}

      {rollbackMsg && (
        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-purple-400 shrink-0" />
          {rollbackMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-xl border border-slate-800">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Strategy</p>
          <p className="mt-1 text-xl font-bold text-white font-mono uppercase">{deployment.strategy}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Threshold: {deployment.rollback_threshold * 100}%</p>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-slate-800">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Total Target Units</p>
          <p className="mt-1 text-xl font-bold text-cyan-400 font-mono">{deployment.total_devices}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Fleet units targeted</p>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-slate-800">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Success Rate</p>
          <p className="mt-1 text-xl font-bold text-emerald-400 font-mono">
            {deployment.success_count} / {deployment.total_devices}
          </p>
          <p className="text-[11px] text-emerald-500/80 mt-0.5">Successfully upgraded</p>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-slate-800">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Failures</p>
          <p className="mt-1 text-xl font-bold text-rose-400 font-mono">{deployment.failure_count}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Checksum or install errors</p>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200 uppercase tracking-wider">Overall Rollout Progress</span>
          <span className="font-mono text-cyan-400 font-bold">{progressPercent}%</span>
        </div>
        <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Robot Nodes Telemetry ({devices.length})
          </h3>
          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            Streaming MQTT updates
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Device</th>
                <th className="px-6 py-3.5">HW Model</th>
                <th className="px-6 py-3.5">Factory</th>
                <th className="px-6 py-3.5">Version Transition</th>
                <th className="px-6 py-3.5">Progress</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Diagnostic Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500 font-sans">
                    No robot units attached to this rollout.
                  </td>
                </tr>
              ) : (
                devices.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4 font-semibold text-white flex items-center gap-2">
                      <Bot className="w-4 h-4 text-cyan-400" />
                      {d.device_id}
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-sans">{d.hw_model || "sim-v1"}</td>
                    <td className="px-6 py-4 text-slate-400 font-sans">{d.factory_id || "factory-local"}</td>
                    <td className="px-6 py-4 text-slate-300">
                      v{d.previous_version || "1.0.0"} &rarr; v{targetVersion || "Target"}
                    </td>
                    <td className="px-6 py-4 w-48">
                      <div className="flex items-center gap-3">
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              d.status === "failed"
                                ? "bg-rose-500"
                                : d.status === "success"
                                ? "bg-emerald-500"
                                : "bg-cyan-400"
                            }`}
                            style={{ width: `${d.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 w-8">{d.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-sans">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-6 py-4 font-sans text-slate-400 max-w-xs truncate">
                      {d.error_message ? (
                        <span className="text-rose-400 flex items-center gap-1">
                          <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                          {d.error_message}
                        </span>
                      ) : d.status === "success" ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          Checksum verified & booted
                        </span>
                      ) : (
                        "Transmitting payload..."
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
