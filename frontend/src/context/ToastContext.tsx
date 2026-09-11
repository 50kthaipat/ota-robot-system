"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertOctagon, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
}

interface ToastContextType {
  showToast: (title: string, message?: string, type?: ToastType, durationMs?: number) => void;
  toast: {
    success: (title: string, message?: string, durationMs?: number) => void;
    error: (title: string, message?: string, durationMs?: number) => void;
    warning: (title: string, message?: string, durationMs?: number) => void;
    info: (title: string, message?: string, durationMs?: number) => void;
  };
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (title: string, message?: string, type: ToastType = "info", durationMs: number = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastItem = { id, title, message, type, durationMs };

      setToasts((prev) => [newToast, ...prev].slice(0, 5));

      if (durationMs > 0) {
        setTimeout(() => {
          removeToast(id);
        }, durationMs);
      }
    },
    [removeToast]
  );

  const toast = {
    success: (title: string, message?: string, durationMs?: number) =>
      showToast(title, message, "success", durationMs),
    error: (title: string, message?: string, durationMs?: number) =>
      showToast(title, message, "error", durationMs),
    warning: (title: string, message?: string, durationMs?: number) =>
      showToast(title, message, "warning", durationMs),
    info: (title: string, message?: string, durationMs?: number) =>
      showToast(title, message, "info", durationMs),
  };

  return (
    <ToastContext.Provider value={{ showToast, toast, removeToast }}>
      {children}

      {/* Top-Center Toast Container */}
      <div
        aria-live="polite"
        className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none w-full max-w-md px-4 transition-all"
      >
        {toasts.map((item) => {
          const typeConfig = {
            success: {
              border: "border-semantic-success/40",
              bg: "bg-surface-1/95 shadow-semantic-success/5",
              icon: <CheckCircle2 className="w-4 h-4 text-semantic-success shrink-0 mt-0.5" />,
              badgeBg: "bg-semantic-success/15 text-semantic-success",
              titleColor: "text-semantic-success",
            },
            error: {
              border: "border-semantic-error/40",
              bg: "bg-surface-1/95 shadow-semantic-error/5",
              icon: <AlertOctagon className="w-4 h-4 text-semantic-error shrink-0 mt-0.5" />,
              badgeBg: "bg-semantic-error/15 text-semantic-error",
              titleColor: "text-semantic-error",
            },
            warning: {
              border: "border-semantic-warning/40",
              bg: "bg-surface-1/95 shadow-semantic-warning/5",
              icon: <AlertTriangle className="w-4 h-4 text-semantic-warning shrink-0 mt-0.5" />,
              badgeBg: "bg-semantic-warning/15 text-semantic-warning",
              titleColor: "text-semantic-warning",
            },
            info: {
              border: "border-primary/40",
              bg: "bg-surface-1/95 shadow-primary/5",
              icon: <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />,
              badgeBg: "bg-primary/15 text-primary",
              titleColor: "text-primary",
            },
          }[item.type];

          return (
            <div
              key={item.id}
              role="status"
              className={`pointer-events-auto w-full flex items-start gap-3 p-3.5 rounded-xl border ${typeConfig.border} ${typeConfig.bg} backdrop-blur-md shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100 animate-in fade-in slide-in-from-top-3`}
            >
              {typeConfig.icon}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${typeConfig.titleColor} tracking-tight`}>
                  {item.title}
                </p>
                {item.message && (
                  <p className="text-[11px] text-ink-subtle mt-0.5 leading-relaxed break-words font-sans">
                    {item.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(item.id)}
                className="text-ink-tertiary hover:text-ink p-0.5 rounded transition-colors shrink-0"
                aria-label="Close notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
