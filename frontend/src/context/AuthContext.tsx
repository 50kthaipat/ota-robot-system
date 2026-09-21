"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Cpu } from "lucide-react";
import { User } from "@/lib/types";
import { api } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => setMounted(true), []);

  const restoreSession = useCallback(async () => {
    try {
      const response = await api.getMe();
      setUser(response.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (!mounted || isLoading) return;
    if (!user && pathname !== "/login") router.replace("/login");
    if (user && pathname === "/login") router.replace("/");
  }, [isLoading, mounted, pathname, router, user]);

  const login = async (username: string, password: string) => {
    const response = await api.login({ username, password });
    setUser(response.user);
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      router.replace("/login");
    }
  };

  const showLoadingOverlay = mounted && isLoading && pathname !== "/login";
  const canRenderChildren = pathname === "/login" || Boolean(user);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {canRenderChildren ? children : null}
      {showLoadingOverlay && (
        <div className="fixed inset-0 z-50 flex h-screen w-screen select-none flex-col items-center justify-center bg-canvas text-ink">
          <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3.5 text-primary shadow-lg motion-safe:animate-pulse">
              <Cpu className="h-8 w-8" aria-hidden="true" />
            </div>
            <div className="space-y-1.5 text-center">
              <p className="font-mono text-xs font-medium uppercase tracking-wider text-ink-muted">Verifying session</p>
              <p className="font-mono text-[11px] text-ink-tertiary">Connecting to control plane…</p>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
