"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Bot, RefreshCw, Rocket, Search, Filter, Cpu, CheckCircle2, Clock, Wifi } from "lucide-react";
import { api } from "@/lib/api";
import { Device } from "@/lib/types";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";

export default function FleetOverviewPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [factoryFilter, setFactoryFilter] = useState<string>("all");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadFleet = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await api.getDevices();
      setDevices(res.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to load devices", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadFleet();
    const timer = setInterval(() => {
      loadFleet(true);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const factories = useMemo(() => {
    const list = new Set<string>();
    devices.forEach((d) => list.add(d.factory_id));
    return Array.from(list);
  }, [devices]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const matchesSearch =
        d.id.toLowerCase().includes(search.toLowerCase()) ||
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.hw_model.toLowerCase().includes(search.toLowerCase());
      const matchesFactory = factoryFilter === "all" || d.factory_id === factoryFilter;
      return matchesSearch && matchesFactory;
    });
  }, [devices, search, factoryFilter]);

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
    <div className="p-8 max-w-7xl w-full mx-auto space-y-8">
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
          <button
            onClick={() => loadFleet()}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-surface-1 hover:bg-surface-2 text-ink-muted border border-hairline hover:border-hairline-strong transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-primary" : "text-ink-tertiary"}`} />
            <span>Updated {formatRelativeTime(lastUpdated.toISOString())}</span>
          </button>

          <Link
            href="/deploy"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium bg-primary hover:bg-primary-hover active:bg-primary-focus text-white transition-colors"
          >
            <Rocket className="w-3.5 h-3.5" />
            Launch Rollout
          </Link>
        </div>
      </div>

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
        <div className="p-4 border-b border-hairline flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-ink-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by device ID, model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-md bg-surface-2 border border-hairline text-ink placeholder-ink-tertiary focus:outline-none focus:border-primary-focus focus:ring-1 focus:ring-primary-focus/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-ink-tertiary" />
            <select
              value={factoryFilter}
              onChange={(e) => setFactoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-md bg-surface-2 border border-hairline text-ink-muted focus:outline-none focus:border-primary-focus transition-colors"
            >
              <option value="all">All Factories</option>
              {factories.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Devices Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas text-ink-subtle uppercase tracking-eyebrow text-[11px] border-b border-hairline">
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
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
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
                filteredDevices.map((device) => (
                  <tr key={device.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-ink flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                      {device.id}
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
                    <td className="px-6 py-3.5 text-right font-sans">
                      <Link
                        href={`/deploy?device=${device.id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary-hover hover:text-primary transition-colors font-medium"
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
      </div>
    </div>
  );
}
