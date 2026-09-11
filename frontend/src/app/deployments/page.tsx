"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, RefreshCw, Rocket, Eye, CheckCircle2, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { Deployment } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";

export default function DeploymentsHistoryPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadDeployments = async () => {
    try {
      const res = await api.getDeployments();
      setDeployments(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeployments();
    const timer = setInterval(() => {
      loadDeployments();
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Rollout Deployments History
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Historical audit log of all OTA firmware distribution jobs across the fleet.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadDeployments()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-1 hover:bg-surface-2 text-ink border border-hairline transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-ink-muted" />
            Refresh
          </button>

          <Link
            href="/deploy"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-primary hover:bg-primary-hover active:bg-primary-focus text-white shadow-sm transition"
          >
            <Rocket className="w-3.5 h-3.5" />
            New Rollout
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-1 rounded-lg border border-hairline overflow-hidden">
        <div className="px-4 py-3 border-b border-hairline flex items-center justify-between bg-surface-1">
          <h3 className="text-[11px] font-mono font-medium text-ink-muted uppercase tracking-wider">
            Deployments ({deployments.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2/60 text-ink-muted uppercase tracking-wider text-[11px] font-mono border-b border-hairline">
              <tr>
                <th className="px-5 py-3">Deployment ID</th>
                <th className="px-5 py-3">Target Firmware</th>
                <th className="px-5 py-3">Strategy</th>
                <th className="px-5 py-3">Target Units</th>
                <th className="px-5 py-3">Results</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created At</th>
                <th className="px-5 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-ink-subtle font-sans">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
                    Loading deployment history...
                  </td>
                </tr>
              ) : deployments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-ink-subtle font-sans">
                    No deployments found. Use the &quot;New Rollout&quot; button to launch one.
                  </td>
                </tr>
              ) : (
                deployments.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-2/40 transition">
                    <td className="px-5 py-3.5 font-medium text-ink flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                      {d.id.slice(0, 13)}...
                    </td>
                    <td className="px-5 py-3.5">
                      {d.firmware_version ? (
                        <span className="px-2 py-0.5 rounded bg-surface-2 text-primary border border-hairline font-mono text-[11px]">
                          v{d.firmware_version}
                        </span>
                      ) : (
                        <span className="text-ink-subtle font-sans">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 uppercase text-ink-muted font-mono">{d.strategy}</td>
                    <td className="px-5 py-3.5 text-ink-muted font-sans">{d.total_devices} units</td>
                    <td className="px-5 py-3.5 font-sans">
                      <span className="text-semantic-success">{d.success_count} succeeded</span>
                      {d.failure_count > 0 && (
                        <span className="text-semantic-error ml-2">({d.failure_count} failed)</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-sans">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-5 py-3.5 text-ink-subtle font-sans">
                      {new Date(d.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right font-sans">
                      <Link
                        href={`/deployments/${d.id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium transition"
                      >
                        Monitor <Eye className="w-3.5 h-3.5" />
                      </Link>
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
