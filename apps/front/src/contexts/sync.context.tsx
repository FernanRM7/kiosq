import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import * as salesRepo from "@/db/repositories/sales.repo";
import { request } from "@/lib/api";

type SyncStatus = "idle" | "syncing" | "error";

interface SyncPushFailedItem {
  code: string;
  id: number;
  message: string;
}

interface SyncPushResponse {
  applied: number[];
  failed: SyncPushFailedItem[];
}

const CONFLICT_CODES = new Set(["INSUFFICIENT_STOCK"]);
const REJECTED_CODES = new Set([
  "PRODUCT_NOT_FOUND",
  "MISSING_OFFLINE_ID",
  "UNKNOWN_EVENT_TYPE",
  "BAD_REQUEST",
  "FORBIDDEN",
]);

function isRetryable(code: string): boolean {
  return !CONFLICT_CODES.has(code) && !REJECTED_CODES.has(code);
}

const SyncContext = createContext({
  isOnline: true,
  pendingCount: 0,
  status: "idle" as SyncStatus,
  syncNow: () => Promise.resolve(),
});

export const useSync = () => useContext(SyncContext);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [pendingCount, setPendingCount] = useState<number>(0);

  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncNowRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const MAX_RETRIES = 8;
  const BASE_DELAY = 2000;
  const MAX_DELAY = 300_000;

  const resetRetry = useCallback(() => {
    retryCountRef.current = 0;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const nextDelay = useCallback((attempt: number) => {
    const exponential = Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY);
    return exponential * (0.8 + Math.random() * 0.4);
  }, []);

  const scheduleRetry = useCallback(() => {
    if (retryCountRef.current >= MAX_RETRIES) {
      return;
    }

    const delay = nextDelay(retryCountRef.current);
    retryCountRef.current += 1;

    retryTimerRef.current = setTimeout(() => void syncNowRef.current(), delay);
  }, [nextDelay]);

  const refreshPending = useCallback(async () => {
    const c = await salesRepo.getPendingSyncCount();
    setPendingCount(c);
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => void refreshPending(), 0);
    const onOnline = () => {
      setIsOnline(true);
    };
    const onOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearTimeout(refreshTimer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshPending]);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) {
      return;
    }
    setStatus("syncing");
    try {
      const events = await salesRepo.getPendingEvents(100);
      if (events.length === 0) {
        resetRetry();
        setStatus("idle");
        await refreshPending();
        return;
      }

      const res = await request<SyncPushResponse>("/api/sync/push", {
        data: { events },
        method: "POST",
      });

      if (res.applied.length > 0) {
        await Promise.all(
          res.applied.map((id) => salesRepo.markEventApplied(id))
        );
      }

      await Promise.all(
        res.failed.map((fail) => {
          if (CONFLICT_CODES.has(fail.code)) {
            return salesRepo.markEventConflict(fail.id);
          }
          return REJECTED_CODES.has(fail.code)
            ? salesRepo.markEventRejected(fail.id)
            : undefined;
        })
      );

      const hasRetryable = res.failed.some((f) => isRetryable(f.code));

      if (res.applied.length > 0 || !hasRetryable) {
        resetRetry();
      }

      if (hasRetryable) {
        scheduleRetry();
      }

      setStatus("idle");
      await refreshPending();
    } catch {
      setStatus("error");
      scheduleRetry();
    }
  }, [refreshPending, resetRetry, scheduleRetry]);

  useEffect(() => {
    syncNowRef.current = syncNow;
  }, [syncNow]);

  useEffect(() => {
    if (isOnline) {
      const t = setTimeout(() => {
        syncNow();
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [isOnline, syncNow]);

  useEffect(() => () => resetRetry(), [resetRetry]);

  const contextValue = useMemo(
    () => ({ isOnline, pendingCount, status, syncNow }),
    [isOnline, pendingCount, status, syncNow]
  );

  return (
    <SyncContext.Provider value={contextValue}>{children}</SyncContext.Provider>
  );
};
