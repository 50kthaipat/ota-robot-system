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
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-cyan-400" />
            Fleet Overview
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Real-time telemetry and firmware deployment tracking for robot units.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadFleet()}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
            <span>Updated {formatRelativeTime(lastUpdated.toISOString())}</span>
          </button>

          <Link
            href="/deploy"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 transition"
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
          color="amber"
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
      <div className="glass-panel rounded-xl border border-slate-800/80 overflow-hidden">
        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by device ID, model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={factoryFilter}
              onChange={(e) => setFactoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500"
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
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider border-b border-slate-800">
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
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-sans">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400 mb-2" />
                    Connecting to telemetry streams...
                  </td>
                </tr>
              ) : filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-sans">
                    No robot units match your search filters.
                  </td>
                </tr>
              ) : (
                filteredDevices.map((device) => (
                  <tr key={device.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4 font-semibold text-white flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                      {device.id}
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-sans">{device.factory_id}</td>
                    <td className="px-6 py-4 text-slate-400">{device.hw_model}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                        v{device.current_version}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-sans">
                      <StatusBadge status={device.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-sans">
                      {formatRelativeTime(device.last_seen)}
                    </td>
                    <td className="px-6 py-4 text-right font-sans">
                      <Link
                        href={`/deploy?device=${device.id}`}
                        className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition"
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
