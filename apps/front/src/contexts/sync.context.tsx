import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

import * as salesRepo from "@/db/repositories/sales.repo";
import { request } from "@/lib/api";

type SyncStatus = "idle" | "syncing" | "error";

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

  const refreshPending = useCallback(async () => {
    const c = await salesRepo.getPendingSyncCount();
    setPendingCount(c);
  }, []);

  useEffect(() => {
    refreshPending();
    const onOnline = () => {
      setIsOnline(true);
    };
    const onOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
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
        setStatus("idle");
        await refreshPending();
        return;
      }

      // send to server using API client's signature
      const res = await request<{ applied: number[] }>("/api/sync/push", {
        data: { events },
        method: "POST",
      });
      if (res?.applied?.length) {
        await Promise.all(
          res.applied.map((id) => salesRepo.markEventApplied(id))
        );
      }

      setStatus("idle");
      await refreshPending();
    } catch {
      setStatus("error");
    }
  }, [refreshPending]);

  useEffect(() => {
    if (isOnline) {
      // attempt sync after short delay
      const t = setTimeout(() => {
        syncNow();
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [isOnline, syncNow]);

  return (
    <SyncContext.Provider value={{ isOnline, pendingCount, status, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
};
