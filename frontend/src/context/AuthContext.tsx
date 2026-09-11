"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User } from "@/lib/types";
import { api, setAccessToken } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Attempt initial session restore via HttpOnly cookie refresh
  const restoreSession = useCallback(async () => {
    try {
      const res = await api.refresh();
      setUser(res.user);
      setToken(res.token);
      setAccessToken(res.token);
    } catch {
      setUser(null);
      setToken(null);
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = async (username: string, password: string) => {
    const res = await api.login({ username, password });
    setUser(res.user);
    setToken(res.token);
    setAccessToken(res.token);
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setToken(null);
      setAccessToken(null);
    }
  };

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
