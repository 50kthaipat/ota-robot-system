"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, HardDriveDownload, Rocket, Activity, Radio, Cpu, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

export const Sidebar = () => {
  const pathname = usePathname();
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      const ok = await api.getHealth();
      setIsBackendHealthy(ok);
    };
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { label: "Fleet Overview", href: "/", icon: Bot },
    { label: "Firmware Catalog", href: "/firmware", icon: HardDriveDownload },
    { label: "Launch Rollout", href: "/deploy", icon: Rocket },
    { label: "Rollout History", href: "/deployments", icon: Activity },
  ];

  return (
    <aside className="w-64 glass-panel border-r border-slate-800/80 flex flex-col justify-between p-4 min-h-screen">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-4 mb-6 border-b border-slate-800/80">
          <div className="p-2 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide text-white flex items-center gap-1.5">
              ROBO-OTA
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 font-mono">v1.0</span>
            </h1>
            <p className="text-[11px] text-slate-400">Fleet Control Plane</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-slate-400" />
            Backend API
          </span>
          {isBackendHealthy === null ? (
            <span className="text-slate-400 font-mono text-[10px]">Checking...</span>
          ) : isBackendHealthy ? (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              ONLINE
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-rose-400 font-medium font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              OFFLINE
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
          <span className="text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            Cluster
          </span>
          <span className="text-slate-300 font-mono text-[11px]">factory-local</span>
        </div>
      </div>
    </aside>
  );
};
