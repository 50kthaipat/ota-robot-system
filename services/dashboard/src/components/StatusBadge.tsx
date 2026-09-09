import React from "react";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = "" }) => {
  const s = status.toLowerCase();

  switch (s) {
    case "online":
    case "success":
    case "completed":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      );

    case "updating":
    case "running":
    case "downloading":
    case "installing":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      );

    case "failed":
    case "error":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      );

    case "rolled_back":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
          Rolled Back
        </span>
      );

    case "pending":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          Pending
        </span>
      );

    case "offline":
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      );
  }
};
