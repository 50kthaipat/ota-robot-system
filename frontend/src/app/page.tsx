"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Bot, RefreshCw, Rocket, Search, Filter, Cpu, Clock, Wifi, Info, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Device, getErrorMessage } from "@/lib/types";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Pagination } from "@/components/Pagination";
import { RobotDetailModal } from "@/components/RobotDetailModal";
import { useToast } from "@/context/ToastContext";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";

export default function FleetOverviewPage() {
  const { showToast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [factoryFilter, setFactoryFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPruning, setIsPruning] = useState<boolean>(false);
  const [showPruneConfirm, setShowPruneConfirm] = useState<boolean>(false);

  const formatRobotModel = (model: string) => {
    const map: Record<string, string> = {
      "agv-v1": "AGV (agv-v1)",
      "scara-v1": "SCARA (scara-v1)",
      "delta-v2": "Delta (delta-v2)",
      "articulated-v3": "Articulated (articulated-v3)",
      "cartesian-v1": "Cartesian (cartesian-v1)",
    };
    return map[model] || model;
  };

  const loadFleet = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await api.getDevices();
      setDevices(res.data || []);
      setLastUpdated(new Date());
      setLoadError(null);
    } catch {
      setLoadError("Live fleet data is unavailable. Showing the last successful snapshot.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handlePruneOffline = async () => {
    setIsPruning(true);
    try {
      const res = await api.pruneOfflineDevices();
      showToast(
        "Offline Units Pruned",
        `Successfully cleaned up ${res.deleted_count} offline robot records from registry`,
        "success"
      );
      setShowPruneConfirm(false);
      await loadFleet(true);
    } catch (err: unknown) {
      showToast("Prune Failed", getErrorMessage(err, "Failed to prune offline devices"), "error");
    } finally {
      setIsPruning(false);
    }
  };

  useEffect(() => {
    loadFleet();
  }, []);

  useVisibilityPolling(() => loadFleet(true), 15000);

  const factories = useMemo(() => {
    const list = new Set<string>();
    devices.forEach((d) => {
      if (d.factory_id) list.add(d.factory_id);
    });
    return Array.from(list).sort();
  }, [devices]);

  const robotModels = useMemo(() => {
    const list = new Set<string>();
    devices.forEach((d) => {
      if (d.hw_model) list.add(d.hw_model);
    });
    return Array.from(list).sort();
  }, [devices]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const matchesSearch =
        d.id.toLowerCase().includes(search.toLowerCase()) ||
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.hw_model.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || d.status === statusFilter;
      const matchesModel = modelFilter === "all" || d.hw_model === modelFilter;
      const matchesFactory = factoryFilter === "all" || d.factory_id === factoryFilter;
      return matchesSearch && matchesStatus && matchesModel && matchesFactory;
    });
  }, [devices, search, statusFilter, modelFilter, factoryFilter]);

  // Reset pagination to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, modelFilter, factoryFilter]);

  const paginatedDevices = useMemo(() => {
    return filteredDevices.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredDevices, currentPage, pageSize]);

  const stats = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => d.status === "online").length;
    const updating = devices.filter((d) => d.status === "updating").length;
    const offline = devices.filter((d) => d.status === "offline" || d.status === "error").length;
    return { total, online, updating, offline };
  }, [devices]);

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 5) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink flex items-center gap-2.5">
            <Bot className="w-5 h-5 text-primary" />
            Fleet Overview
          </h2>
          <p className="text-xs text-ink-subtle mt-1 tracking-wide">
            Real-time telemetry and firmware deployment tracking for robot units.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {stats.offline > 0 && (
            showPruneConfirm ? (
              <div className="flex items-center gap-1.5 p-1 rounded-md bg-surface-2 border border-semantic-error/30">
                <span className="text-[11px] text-semantic-error px-1 font-mono">Remove {stats.offline} offline?</span>
                <button
                  type="button"
                  onClick={handlePruneOffline}
                  disabled={isPruning}
                  className="min-h-11 px-2.5 py-1 text-xs rounded bg-semantic-error-strong hover:bg-semantic-error-strong/90 text-white font-medium transition-colors"
                >
                  {isPruning ? "Pruning..." : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPruneConfirm(false)}
                  className="min-h-11 px-2 py-1 text-xs rounded hover:bg-surface-3 text-ink-muted transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowPruneConfirm(true)}
                className="flex min-h-11 items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-semantic-error/10 hover:bg-semantic-error/20 text-semantic-error border border-semantic-error/25 transition-colors"
                title="Clean up all disconnected offline robots from registry"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Prune Offline ({stats.offline})</span>
              </button>
            )
          )}

          <button
            onClick={() => loadFleet()}
            disabled={isRefreshing}
            className="flex min-h-11 items-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-surface-1 hover:bg-surface-2 text-ink-muted border border-hairline hover:border-hairline-strong transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "motion-safe:animate-spin text-primary" : "text-ink-tertiary"}`} />
            <span>{lastUpdated ? `Updated ${formatRelativeTime(lastUpdated.toISOString())}` : "Refresh fleet"}</span>
          </button>

          <Link
            href="/deploy"
            className="flex min-h-11 items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium bg-primary hover:bg-primary-hover active:bg-primary-focus text-surface-1 transition-colors"
          >
            <Rocket className="w-3.5 h-3.5" />
            Launch Rollout
          </Link>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-semantic-warning/30 bg-semantic-warning/10 p-4 text-xs text-semantic-warning sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{loadError}</span>
          <button type="button" onClick={() => void loadFleet()} className="min-h-11 rounded-lg border border-semantic-warning/30 px-3 font-medium hover:bg-semantic-warning/10">Retry now</button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Units"
          value={stats.total}
          subtitle="Registered robot nodes"
          icon={Bot}
          color="blue"
        />
        <MetricCard
          title="Units Online"
          value={stats.online}
          subtitle="Broadcasting heartbeats"
          icon={Wifi}
          color="emerald"
        />
        <MetricCard
          title="Flashing / Updating"
          value={stats.updating}
          subtitle="Firmware in progress"
          icon={Cpu}
          color="cyan"
        />
        <MetricCard
          title="Units Offline"
          value={stats.offline}
          subtitle="Unreachable units"
          icon={Clock}
          color="rose"
        />
      </div>

      {/* Fleet Filter & Table */}
      <div className="bg-surface-1 rounded-xl border border-hairline overflow-hidden">
        {/* Filter Bar */}
        <div className="p-4 border-b border-hairline flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-surface-1">
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-ink-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="fleet-search"
              name="fleet-search"
              aria-label="Search fleet by device ID, name, or model"
              type="text"
              placeholder="Search by device ID, model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-11 w-full pl-9 pr-4 py-2 text-base sm:text-xs rounded-md bg-surface-2 border border-hairline text-ink placeholder-ink-tertiary focus:outline-none focus:border-primary-focus focus:ring-1 focus:ring-primary-focus/50 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-ink-tertiary mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">Filter:</span>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-11 px-2.5 py-2 text-base sm:text-xs rounded-md bg-surface-2 border border-hairline text-ink-muted focus:outline-none focus:border-primary-focus transition-colors"
              aria-label="Filter by Status"
            >
              <option value="all">All Statuses</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="updating">Updating</option>
              <option value="error">Error</option>
            </select>

            {/* Robot Type / Model Filter */}
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="min-h-11 px-2.5 py-2 text-base sm:text-xs rounded-md bg-surface-2 border border-hairline text-ink-muted focus:outline-none focus:border-primary-focus transition-colors"
              aria-label="Filter by Robot Type"
            >
              <option value="all">All Robot Types</option>
              {robotModels.map((m) => (
                <option key={m} value={m}>
                  {formatRobotModel(m)}
                </option>
              ))}
            </select>

            {/* Factory Filter */}
            <select
              value={factoryFilter}
              onChange={(e) => setFactoryFilter(e.target.value)}
              className="min-h-11 px-2.5 py-2 text-base sm:text-xs rounded-md bg-surface-2 border border-hairline text-ink-muted focus:outline-none focus:border-primary-focus transition-colors"
              aria-label="Filter by Factory"
            >
              <option value="all">All Factories</option>
              {factories.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            {/* Reset Button (Always visible) */}
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setModelFilter("all");
                setFactoryFilter("all");
              }}
              disabled={statusFilter === "all" && modelFilter === "all" && factoryFilter === "all" && search === ""}
              className={`min-h-11 px-2.5 py-2 text-xs rounded-md border font-medium transition-colors ${
                statusFilter !== "all" || modelFilter !== "all" || factoryFilter !== "all" || search !== ""
                  ? "bg-surface-2 hover:bg-surface-3 border-hairline text-ink cursor-pointer hover:border-hairline-strong"
                  : "bg-surface-1 border-hairline/40 text-ink-tertiary/40 cursor-not-allowed"
              }`}
              title={
                statusFilter !== "all" || modelFilter !== "all" || factoryFilter !== "all" || search !== ""
                  ? "Reset all filters to default"
                  : "No active filters to reset"
              }
            >
              Reset
            </button>
          </div>
        </div>

        {/* Devices Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2/60 text-ink-muted uppercase tracking-wider text-[11px] font-mono border-b border-hairline">
              <tr>
                <th className="px-6 py-3.5">Device ID</th>
                <th className="px-6 py-3.5">Factory</th>
                <th className="px-6 py-3.5">HW Model</th>
                <th className="px-6 py-3.5">Active Firmware</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Last Seen</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-ink-tertiary font-sans">
                    <RefreshCw className="w-5 h-5 motion-safe:animate-spin mx-auto text-primary mb-2" />
                    Connecting to telemetry streams...
                  </td>
                </tr>
              ) : filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-ink-tertiary font-sans">
                    No robot units match your search filters.
                  </td>
                </tr>
              ) : (
                paginatedDevices.map((device) => (
                  <tr key={device.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-ink">
                      <button
                        onClick={() => setSelectedDevice(device)}
                        className="flex items-center gap-2 text-left hover:text-primary transition group"
                        title="Click to view full telemetry & node specifications"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary group-hover:scale-125 transition-transform shrink-0" />
                        <span className="underline decoration-hairline group-hover:decoration-primary underline-offset-4 font-mono font-medium">
                          {device.name || device.id}
                        </span>
                        <Info className="w-3.5 h-3.5 text-ink-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>
                    <td className="px-6 py-3.5 text-ink-muted font-sans">{device.factory_id}</td>
                    <td className="px-6 py-3.5 text-ink-subtle">{device.hw_model}</td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded bg-surface-2 text-primary-hover border border-hairline text-[11px]">
                        v{device.current_version}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-sans">
                      <StatusBadge status={device.status} />
                    </td>
                    <td className="px-6 py-3.5 text-ink-subtle font-sans">
                      {formatRelativeTime(device.last_seen)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-sans space-x-3">
                      <button
                        onClick={() => setSelectedDevice(device)}
                        className="inline-flex min-h-11 items-center gap-1 px-2 text-xs text-ink-muted hover:text-ink transition-colors font-medium"
                        title="Inspect Telemetry"
                      >
                        Details
                      </button>
                      <Link
                        href={`/deploy?device=${device.id}`}
                        className="inline-flex min-h-11 items-center gap-1 px-2 text-xs text-primary-hover hover:text-primary transition-colors font-medium"
                      >
                        Rollout <Rocket className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredDevices.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredDevices.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20]}
          />
        )}
      </div>

      {/* Robot Detail & Telemetry Modal */}
      <RobotDetailModal
        device={selectedDevice}
        isOpen={!!selectedDevice}
        onClose={() => setSelectedDevice(null)}
        onDeleted={() => void loadFleet(true)}
      />
    </div>
  );
}
