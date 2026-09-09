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
  }, []);

  return (
    <div className="p-8 max-w-7xl w-full mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-cyan-400" />
            Rollout Deployments History
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Historical audit log of all OTA firmware distribution jobs across the fleet.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadDeployments()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>

          <Link
            href="/deploy"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 transition"
          >
            <Rocket className="w-3.5 h-3.5" />
            New Rollout
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Deployments ({deployments.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Deployment ID</th>
                <th className="px-6 py-3.5">Target Firmware</th>
                <th className="px-6 py-3.5">Strategy</th>
                <th className="px-6 py-3.5">Target Units</th>
                <th className="px-6 py-3.5">Results</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Created At</th>
                <th className="px-6 py-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-sans">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400 mb-2" />
                    Loading deployment history...
                  </td>
                </tr>
              ) : deployments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-sans">
                    No deployments found. Use the &quot;New Rollout&quot; button to launch one.
                  </td>
                </tr>
              ) : (
                deployments.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                      {d.id.slice(0, 13)}...
                    </td>
                    <td className="px-6 py-4">
                      {d.firmware_version ? (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono text-[11px]">
                          v{d.firmware_version}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-sans">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 uppercase text-slate-300 font-sans">{d.strategy}</td>
                    <td className="px-6 py-4 text-slate-300 font-sans">{d.total_devices} units</td>
                    <td className="px-6 py-4 font-sans">
                      <span className="text-emerald-400">{d.success_count} succeeded</span>
                      {d.failure_count > 0 && (
                        <span className="text-rose-400 ml-2">({d.failure_count} failed)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-sans">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-sans">
                      {new Date(d.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-sans">
                      <Link
                        href={`/deployments/${d.id}`}
                        className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition"
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
