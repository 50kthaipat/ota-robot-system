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
    bg: "bg-primary/10",
    text: "text-primary-hover",
    border: "border-primary/20",
  },
  emerald: {
    bg: "bg-semantic-success/10",
    text: "text-semantic-success",
    border: "border-semantic-success/20",
  },
  amber: {
    bg: "bg-semantic-warning/10",
    text: "text-semantic-warning",
    border: "border-semantic-warning/20",
  },
  rose: {
    bg: "bg-semantic-error/10",
    text: "text-semantic-error",
    border: "border-semantic-error/20",
  },
  blue: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
  },
  purple: {
    bg: "bg-semantic-secure/10",
    text: "text-semantic-secure",
    border: "border-semantic-secure/20",
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
    <div className="bg-surface-1 hover:bg-surface-2 p-5 rounded-xl border border-hairline hover:border-hairline-strong transition-all duration-150">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-eyebrow text-ink-subtle">{title}</p>
          <p className="mt-1.5 text-2xl font-semibold text-ink tracking-card-title">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-ink-tertiary">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-md ${styles.bg} ${styles.text} border ${styles.border}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
