import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cashierLogin, getCashierLoginErrorMessage } from "@/lib/auth";

const TENANT_SLUG =
  (import.meta.env["VITE_KIOSK_TENANT_SLUG"] as string | undefined) ?? "";

export function CashierLoginForm() {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [tenantSlug, setTenantSlug] = useState(TENANT_SLUG);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!code.trim() || !pin.trim() || !tenantSlug.trim()) {
      setError("Completa los datos para iniciar sesión como cajero.");
      return;
    }

    setLoading(true);

    try {
      const result = await cashierLogin({
        cashierCode: code.trim(),
        pin,
        tenantSlug: tenantSlug.trim(),
      });

      window.location.assign(result.redirectTo);
    } catch (submitError) {
      setError(getCashierLoginErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4"
    >
      <div className="flex w-full max-w-xs flex-col gap-3">
        <input
          type="text"
          aria-label="Área de trabajo"
          placeholder="Mi área de trabajo"
          maxLength={120}
          autoComplete="off"
          disabled={loading}
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          className="h-12 rounded-lg border border-input bg-background px-4 text-center text-lg outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
        />
        <input
          type="text"
          aria-label="Código de cajero"
          placeholder="CJ-123456"
          maxLength={20}
          autoFocus
          disabled={loading}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-12 rounded-lg border border-input bg-background px-4 text-center text-lg outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
        />
        <input
          type="password"
          aria-label="PIN"
          inputMode="numeric"
          placeholder="••••••"
          maxLength={6}
          disabled={loading}
          value={pin}
          onChange={(e) => setPin(e.target.value.replaceAll(/\D/gu, ""))}
          className="h-12 rounded-lg border border-input bg-background px-4 text-center text-lg outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
        />

        {error && (
          <p className="text-center text-destructive text-sm">{error}</p>
        )}

        <Button type="submit" disabled={loading} className="h-12 text-base">
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </div>
    </form>
  );
}
