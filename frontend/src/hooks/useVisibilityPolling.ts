"use client";

import { useEffect, useRef } from "react";

type PollCallback = () => void | Promise<void>;

/**
 * Runs polling sequentially while the page is visible. A new request is only
 * scheduled after the previous one settles, preventing overlapping API calls.
 */
export function useVisibilityPolling(
  callback: PollCallback,
  intervalMs: number,
  enabled = true
) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(run, intervalMs);
    };

    const run = async () => {
      if (cancelled || running) return;
      if (document.visibilityState !== "visible") {
        schedule();
        return;
      }

      running = true;
      try {
        await callbackRef.current();
      } finally {
        running = false;
        schedule();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible" || running) return;
      if (timer) clearTimeout(timer);
      void run();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
