import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { request } from "@/lib/api";
import type { ApiClientError } from "@/lib/api";

const TENANT_SLUG =
  (import.meta.env["VITE_KIOSK_TENANT_SLUG"] as string | undefined) ?? "";

export function CashierLoginForm() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError("Ingresa tu código");
      return;
    }

    if (!/^\d{4,6}$/.test(pin)) {
      setError("El PIN debe tener 4-6 dígitos numéricos");
      return;
    }

    if (!TENANT_SLUG) {
      setError(
        "El kiosko no está configurado. Contacta al administrador.",
      );
      return;
    }

    setLoading(true);

    try {
      const result = await request<{ redirectTo: string }>("/auth/pin", {
        data: { code: code.trim(), pin, slug: TENANT_SLUG },
        method: "POST",
      });
      navigate(result.redirectTo);
    } catch (submitError) {
      setError(
        (submitError as ApiClientError).message ?? "Código o PIN incorrecto",
      );
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
          placeholder="Tu código"
          maxLength={20}
          autoFocus
          disabled={loading}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-12 rounded-lg border border-input bg-background px-4 text-center text-lg outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
        />
        <input
          type="password"
          inputMode="numeric"
          placeholder="Tu PIN"
          maxLength={6}
          disabled={loading}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
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
