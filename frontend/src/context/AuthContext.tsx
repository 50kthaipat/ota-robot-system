"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Cpu } from "lucide-react";
import { User } from "@/lib/types";
import { api, setAccessToken } from "@/lib/api";

const USER_STORAGE_KEY = "robo_ota_user";
const TOKEN_STORAGE_KEY = "robo_ota_access_token";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Initialize from localStorage if in browser for instant render (Zero Flash)
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored) as User;
        } catch {}
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored) {
        setAccessToken(stored);
        return stored;
      }
    }
    return null;
  });

  // If we already have a cached user and token in localStorage, do not block the UI on F5 refresh!
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedUser && storedToken) {
        return false; // Instant display!
      }
    }
    return true;
  });

  // Attempt session verification & silent refresh
  const restoreSession = useCallback(async () => {
    try {
      const currentToken = typeof window !== "undefined" ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
      if (currentToken) {
        setAccessToken(currentToken);
        try {
          const mePromise = api.getMe();
          const timeoutPromise = new Promise<{ user: User }>((_, reject) =>
            setTimeout(() => reject(new Error("Verification timeout")), 4000)
          );
          const meRes = await Promise.race([mePromise, timeoutPromise]);
          setUser(meRes.user);
          if (typeof window !== "undefined") {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(meRes.user));
          }
          setIsLoading(false);
          return;
        } catch {
          // Access token might be expired or timed out, attempt refresh below
        }
      }

      // Try refresh endpoint (via cookie or X-Refresh-Token)
      const refreshPromise = api.refresh();
      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error("Refresh timeout")), 4000)
      );
      const res = await Promise.race([refreshPromise, timeoutPromise]);

      setUser(res.user);
      setToken(res.token);
      setAccessToken(res.token, res.refresh_token);
      if (typeof window !== "undefined") {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
        localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
      }
    } catch {
      // Both verification and refresh failed: clear session
      setUser(null);
      setToken(null);
      setAccessToken(null, null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(USER_STORAGE_KEY);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Route guarding: protect all dashboard pages and redirect unauthenticated visits to /login
  useEffect(() => {
    if (!isLoading) {
      if (!user && pathname !== "/login") {
        router.replace("/login");
      } else if (user && pathname === "/login") {
        router.replace("/");
      }
    }
  }, [user, isLoading, pathname, router]);

  const login = async (username: string, password: string) => {
    const res = await api.login({ username, password });
    setUser(res.user);
    setToken(res.token);
    setAccessToken(res.token, res.refresh_token);
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
      localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setToken(null);
      setAccessToken(null, null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(USER_STORAGE_KEY);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      router.replace("/login");
    }
  };

  // If loading and visiting a protected route without cached user, show sleek FULLSCREEN centered loading indicator
  if (isLoading && !user && pathname !== "/login") {
    return (
      <div className="fixed inset-0 z-50 w-screen h-screen bg-canvas flex flex-col items-center justify-center text-ink select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary animate-pulse shadow-lg">
            <Cpu className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 text-center">
            <p className="font-mono text-xs font-medium text-ink-muted uppercase tracking-wider">
              Verifying Session
            </p>
            <p className="font-mono text-[11px] text-ink-tertiary">
              Connecting to Cloud Control Plane...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated and on a protected route, block render until redirect triggers
  if (!isLoading && !user && pathname !== "/login") {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
