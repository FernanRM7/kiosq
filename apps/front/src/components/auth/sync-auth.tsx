import { useEffect } from "react";

import { useMe } from "@/hooks/queries/use-me";
import { useAuthStore } from "@/stores/auth.store";

export function SyncAuth() {
  const { data, isLoading } = useMe();
  const setUser = useAuthStore((s) => s.setUser);
  const setStatus = useAuthStore((s) => s.setStatus);
  const setError = useAuthStore((s) => s.setError);

  useEffect(() => {
    if (isLoading) {
      setStatus("loading");
      return;
    }

    if (data?.success && data.data) {
      setUser(data.data);
      setStatus("authenticated");
      console.log("[Auth] Session hydrated: authenticated");
    } else {
      setUser(null);
      setStatus("unauthenticated");
      console.log("[Auth] Session hydrated: unauthenticated (no cookie)");
    }
  }, [data, isLoading, setUser, setStatus]);

  useEffect(() => {
    if (!isLoading && !data?.success) {
      setError(data === null ? null : "No se pudo validar la sesion.");
    }
  }, [data, isLoading, setError]);

  return null;
}
