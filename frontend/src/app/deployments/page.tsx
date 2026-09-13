"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, RefreshCw, Rocket, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { Deployment } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Pagination } from "@/components/Pagination";

export default function DeploymentsHistoryPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDeployments = async () => {
    try {
      const res = await api.getDeployments();
      setDeployments(res.data || []);
      setLoadError(null);
    } catch {
      setLoadError("Rollout history could not be refreshed. Existing rows may be stale.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeployments();
  }, []);

  useVisibilityPolling(loadDeployments, 15000);

  const paginatedDeployments = deployments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
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
            className="flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-surface-1 hover:bg-surface-2 text-ink border border-hairline transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-ink-muted" />
            Refresh
          </button>

          <Link
            href="/deploy"
            className="flex min-h-11 items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-primary hover:bg-primary-hover active:bg-primary-focus text-surface-1 shadow-sm transition"
          >
            <Rocket className="w-3.5 h-3.5" />
            New Rollout
          </Link>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-semantic-warning/30 bg-semantic-warning/10 p-4 text-xs text-semantic-warning sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{loadError}</span>
          <button type="button" onClick={() => void loadDeployments()} className="min-h-11 rounded-lg border border-semantic-warning/30 px-3 font-medium hover:bg-semantic-warning/10">Retry now</button>
        </div>
      )}

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
                    <RefreshCw className="w-5 h-5 motion-safe:animate-spin mx-auto text-primary mb-2" />
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
                paginatedDeployments.map((d) => (
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

        {deployments.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={deployments.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20, 50]}
          />
        )}
      </div>
    </div>
  );
}
