"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Cpu, ShieldCheck, Lock, AlertOctagon, User as UserIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to overview
  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(username, password);
      router.push("/");
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center items-center px-4 py-12 select-none">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-xl bg-primary/10 border border-primary/25 text-primary mb-2 shadow-sm">
            <Cpu className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink flex items-center justify-center gap-2">
            ROBO-OTA
            <span className="text-xs px-2 py-0.5 rounded bg-surface-2 text-ink-subtle border border-hairline font-mono font-normal">
              v1.0
            </span>
          </h1>
          <p className="text-xs text-ink-muted">
            Fleet Control Plane & Cryptographic Firmware Distribution
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface-1 border border-hairline rounded-xl p-6 shadow-2xl space-y-5">
          <div className="space-y-1">
            <h2 className="text-xs font-semibold text-ink uppercase tracking-wider font-mono">
              Sign In
            </h2>
            <p className="text-[11px] text-ink-subtle">
              Enter your credentials to access fleet nodes and dispatch OTA commands.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-semantic-error/10 border border-semantic-error/30 text-semantic-error text-xs flex items-start gap-2.5">
              <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block text-[11px]">Authentication Error</span>
                <span className="text-[11px] text-semantic-error/90 leading-relaxed block">{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="block text-[11px] font-medium font-mono uppercase tracking-wider text-ink-muted"
              >
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-tertiary">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-surface-2 border border-hairline rounded-lg pl-9 pr-3 py-2 text-xs text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition font-sans"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-[11px] font-medium font-mono uppercase tracking-wider text-ink-muted"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-tertiary">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-surface-2 border border-hairline rounded-lg pl-9 pr-3 py-2 text-xs text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition font-sans"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 px-4 rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Authenticating...
                </>
              ) : (
                <>
                  Access Dashboard
                  <span className="text-sm leading-none">→</span>
                </>
              )}
            </button>
          </form>

          {/* Security Architecture Badge */}
          <div className="pt-3 border-t border-hairline flex items-center justify-between text-[11px] text-ink-subtle">
            <span className="flex items-center gap-1 font-mono text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5 text-semantic-success" />
              OWASP & Zero-Trust Hardened
            </span>
            <span className="font-mono text-[10px] text-ink-tertiary">
              Strict Rate-Limited
            </span>
          </div>
        </div>

        {/* Security Notice Footer */}
        <p className="text-center text-[10px] text-ink-subtle font-mono">
          Authorized personnel only. All access attempts and commands are cryptographically audited.
        </p>
      </div>
    </div>
  );
}
