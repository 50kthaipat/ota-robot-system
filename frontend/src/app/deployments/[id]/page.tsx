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
      <div className="p-12 text-center text-ink-muted">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-3" />
        Connecting to rollout telemetry stream...
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="p-12 text-center text-ink-muted">
        <AlertOctagon className="w-6 h-6 mx-auto text-semantic-error mb-3" />
        Deployment not found or database unreachable.
        <div className="mt-4">
          <Link href="/deployments" className="text-primary hover:underline text-xs font-medium">
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
    <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/deployments"
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Rollout Deployments
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-ink flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Live Deployment Monitor
            </h2>
            <StatusBadge status={deployment.status} />
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-semantic-secure/10 border border-semantic-secure/20 text-semantic-secure text-[11px] font-mono font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              ECDSA P-256 Signed
            </div>
          </div>
          <p className="text-xs text-ink-subtle font-mono mt-1">ID: {deployment.id}</p>
        </div>

        {deployment.status !== "rolled_back" && (
          <button
            onClick={handleRollback}
            disabled={isRollingBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-semantic-error/10 hover:bg-semantic-error/20 active:bg-semantic-error/30 text-semantic-error border border-semantic-error/20 transition disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRollingBack ? "animate-spin" : ""}`} />
            {isRollingBack ? "Aborting & Rolling Back..." : "Trigger Emergency Rollback"}
          </button>
        )}
      </div>

      {deployment.status === "rolled_back" && (
        <div className="p-4 rounded-lg bg-semantic-error/10 border border-semantic-error/20 text-semantic-error text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-5 h-5 text-semantic-error shrink-0" />
            <div>
              <span className="font-semibold text-ink uppercase tracking-wider block">
                {deployment.failure_count / Math.max(1, deployment.total_devices) >= deployment.rollback_threshold
                  ? "Automated Safety Rollback Triggered"
                  : "Manual Emergency Rollback Dispatched"}
              </span>
              <span className="text-ink-muted text-[11px]">
                Failure rate exceeded safety threshold ({Math.round(deployment.rollback_threshold * 100)}%). All fleet nodes have been commanded via MQTT to restore their previous stable firmware version.
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-semantic-error/20 text-semantic-error font-mono text-[10px] font-medium uppercase border border-semantic-error/30">
            Automated Interlock
          </span>
        </div>
      )}

      {deployment.strategy === "canary" && (
        <div className="bg-surface-1 p-5 rounded-lg border border-hairline space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-ink uppercase tracking-wider font-mono">
                Canary Phased Rollout Schedule
              </span>
            </div>
            <span className="text-xs font-mono text-primary font-medium px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
              {deployment.status === "completed"
                ? "Completed: Phase 3 (100% Fleet)"
                : `Active Phase: ${deployment.current_phase || 1} (${deployment.canary_percentage || 20}% Fleet)`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <div
              className={`p-3 rounded-lg border transition ${
                deployment.status === "completed" || (deployment.current_phase || 1) >= 1
                  ? "bg-primary/10 border-primary/30 text-ink"
                  : "bg-surface-2/40 border-hairline text-ink-subtle"
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium uppercase">Phase 1: Canary</span>
                <span className="font-mono text-primary font-bold">20%</span>
              </div>
              <p className="text-[10px] text-ink-muted mt-1">Initial 1 robot node telemetry observation</p>
            </div>

            <div
              className={`p-3 rounded-lg border transition ${
                deployment.status === "completed" || (deployment.current_phase || 1) >= 2
                  ? "bg-primary/10 border-primary/30 text-ink"
                  : "bg-surface-2/40 border-hairline text-ink-subtle"
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium uppercase">Phase 2: Expanded</span>
                <span className="font-mono text-primary font-bold">60%</span>
              </div>
              <p className="text-[10px] text-ink-muted mt-1">Multi-factory telemetry validation</p>
            </div>

            <div
              className={`p-3 rounded-lg border transition ${
                deployment.status === "completed" || (deployment.current_phase || 1) >= 3
                  ? "bg-primary/10 border-primary/30 text-ink"
                  : "bg-surface-2/40 border-hairline text-ink-subtle"
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium uppercase">Phase 3: Full Fleet</span>
                <span className="font-mono text-primary font-bold">100%</span>
              </div>
              <p className="text-[10px] text-ink-muted mt-1">Total distributed fleet upgrade</p>
            </div>
          </div>
        </div>
      )}

      {rollbackMsg && (
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-primary shrink-0" />
          {rollbackMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-surface-1 p-4 rounded-lg border border-hairline">
          <p className="text-[11px] uppercase tracking-wider text-ink-muted font-mono font-medium">Strategy</p>
          <p className="mt-1 text-xl font-bold text-ink font-mono uppercase">{deployment.strategy}</p>
          <p className="text-[11px] text-ink-subtle mt-0.5">Threshold: {Math.round(deployment.rollback_threshold * 100)}%</p>
        </div>

        <div className="bg-surface-1 p-4 rounded-lg border border-hairline">
          <p className="text-[11px] uppercase tracking-wider text-ink-muted font-mono font-medium">Total Target Units</p>
          <p className="mt-1 text-xl font-bold text-primary font-mono">{deployment.total_devices}</p>
          <p className="text-[11px] text-ink-subtle mt-0.5">Fleet units targeted</p>
        </div>

        <div className="bg-surface-1 p-4 rounded-lg border border-hairline">
          <p className="text-[11px] uppercase tracking-wider text-ink-muted font-mono font-medium">Success Rate</p>
          <p className="mt-1 text-xl font-bold text-semantic-success font-mono">
            {deployment.success_count} / {deployment.total_devices}
          </p>
          <p className="text-[11px] text-semantic-success/80 mt-0.5">Successfully upgraded</p>
        </div>

        <div className="bg-surface-1 p-4 rounded-lg border border-hairline">
          <p className="text-[11px] uppercase tracking-wider text-ink-muted font-mono font-medium">Failures</p>
          <p className="mt-1 text-xl font-bold text-semantic-error font-mono">{deployment.failure_count}</p>
          <p className="text-[11px] text-ink-subtle mt-0.5">Checksum or install errors</p>
        </div>
      </div>

      <div className="bg-surface-1 p-5 rounded-lg border border-hairline space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ink uppercase tracking-wider text-[11px] font-mono">Overall Rollout Progress</span>
          <span className="font-mono text-primary font-medium">{progressPercent}%</span>
        </div>
        <div className="w-full bg-surface-2 h-2 rounded-full overflow-hidden border border-hairline">
          <div
            className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      <div className="bg-surface-1 rounded-lg border border-hairline overflow-hidden">
        <div className="px-4 py-3 border-b border-hairline flex items-center justify-between bg-surface-1">
          <h3 className="text-[11px] font-mono font-medium text-ink-muted uppercase tracking-wider">
            Robot Nodes Telemetry ({devices.length})
          </h3>
          <span className="text-[11px] text-ink-subtle font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            Streaming MQTT updates
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2/60 text-ink-muted uppercase tracking-wider text-[11px] font-mono border-b border-hairline">
              <tr>
                <th className="px-5 py-3">Device</th>
                <th className="px-5 py-3">HW Model</th>
                <th className="px-5 py-3">Factory</th>
                <th className="px-5 py-3">Version Transition</th>
                <th className="px-5 py-3">Progress</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Diagnostic Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline font-mono">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-ink-subtle font-sans">
                    No robot units attached to this rollout.
                  </td>
                </tr>
              ) : (
                devices.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-2/40 transition">
                    <td className="px-5 py-3.5 font-medium text-ink flex items-center gap-2">
                      <Bot className="w-4 h-4 text-ink-muted" />
                      {d.device_id}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted font-sans">{d.hw_model || "sim-v1"}</td>
                    <td className="px-5 py-3.5 text-ink-subtle font-sans">{d.factory_id || "factory-local"}</td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      v{d.previous_version || "1.0.0"} → v{targetVersion || "Target"}
                    </td>
                    <td className="px-5 py-3.5 w-48">
                      <div className="flex items-center gap-3">
                        <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden border border-hairline">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              d.status === "failed"
                                ? "bg-semantic-error"
                                : d.status === "success"
                                ? "bg-semantic-success"
                                : "bg-primary"
                            }`}
                            style={{ width: `${d.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-[11px] font-mono text-ink-muted w-8">{d.progress}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-sans">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-5 py-3.5 font-sans text-ink-muted max-w-xs truncate">
                      {d.error_message ? (
                        <span className="text-semantic-error flex items-center gap-1">
                          <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                          {d.error_message}
                        </span>
                      ) : d.status === "success" ? (
                        <span className="text-semantic-success flex items-center gap-1">
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
