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
    <aside className="w-64 bg-surface-1 border-r border-hairline flex flex-col justify-between p-4 min-h-screen select-none">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-4 mb-6 border-b border-hairline">
          <div className="p-2 rounded-md bg-primary/15 border border-primary/30 text-primary">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-tight text-ink flex items-center gap-1.5">
              ROBO-OTA
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-ink-subtle border border-hairline font-mono">v1.0</span>
            </h1>
            <p className="text-[11px] text-ink-subtle tracking-wide">Fleet Control Plane</p>
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
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-primary/10 text-primary-hover border border-primary/25 font-semibold"
                    : "text-ink-subtle hover:text-ink hover:bg-surface-2"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-ink-tertiary"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div className="p-3 rounded-lg bg-surface-2 border border-hairline space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-subtle flex items-center gap-1.5 text-[11px]">
            <Radio className="w-3.5 h-3.5 text-ink-tertiary" />
            Backend API
          </span>
          {isBackendHealthy === null ? (
            <span className="text-ink-tertiary font-mono text-[10px]">Checking...</span>
          ) : isBackendHealthy ? (
            <span className="flex items-center gap-1 text-[11px] text-semantic-success font-medium font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-semantic-success animate-pulse"></span>
              ONLINE
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-semantic-error font-medium font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-semantic-error"></span>
              OFFLINE
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-hairline">
          <span className="text-ink-subtle flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Cluster
          </span>
          <span className="text-ink-muted font-mono text-[11px]">factory-cloud</span>
        </div>
      </div>
    </aside>
  );
};
