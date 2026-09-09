import React from "react";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: "cyan" | "emerald" | "amber" | "rose" | "blue" | "purple";
}

const colorMap = {
  cyan: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-cyan-500/20",
    glow: "hover:border-cyan-500/40",
  },
  emerald: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    glow: "hover:border-emerald-500/40",
  },
  amber: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    glow: "hover:border-amber-500/40",
  },
  rose: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
    glow: "hover:border-rose-500/40",
  },
  blue: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
    glow: "hover:border-blue-500/40",
  },
  purple: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
    glow: "hover:border-purple-500/40",
  },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "blue",
}) => {
  const styles = colorMap[color];

  return (
    <div className={`glass-panel p-5 rounded-xl border transition-all duration-300 ${styles.border} ${styles.glow}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
          <p className="mt-1 text-2xl font-bold text-white tracking-tight">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${styles.bg} ${styles.text}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
