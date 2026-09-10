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
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-semantic-success/10 text-semantic-success border border-semantic-success/20 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-semantic-success animate-pulse"></span>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      );

    case "updating":
    case "running":
    case "downloading":
    case "installing":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-primary/15 text-primary-hover border border-primary/30 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-primary-hover animate-ping"></span>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      );

    case "failed":
    case "error":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-semantic-error/10 text-semantic-error border border-semantic-error/20 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-semantic-error"></span>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      );

    case "rolled_back":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary-secure border border-primary/20 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-primary-secure"></span>
          Rolled Back
        </span>
      );

    case "pending":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-surface-2 text-ink-muted border border-hairline-strong ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-ink-subtle"></span>
          Pending
        </span>
      );

    case "offline":
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-surface-2 text-ink-subtle border border-hairline ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-ink-tertiary"></span>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      );
  }
};
