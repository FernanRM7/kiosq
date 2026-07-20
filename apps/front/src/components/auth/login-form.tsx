import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { cashierLogin, getCashierLoginErrorMessage } from "@/lib/auth";

export function LoginForm() {
  const { error, login, pendingAction } = useAuth();
  const [searchParams] = useSearchParams();
  const callbackMessage = searchParams.get("message");
  const callbackError = searchParams.get("error");
  const displayedError =
    callbackError || callbackMessage
      ? "No se pudo completar la autenticación. Intenta de nuevo."
      : error;
  const isSubmitting = pendingAction === "login";
  const [cashierCode, setCashierCode] = useState("");
  const [cashierError, setCashierError] = useState<string | null>(null);
  const [cashierPin, setCashierPin] = useState("");
  const [cashierTenantSlug, setCashierTenantSlug] = useState("");
  const [isCashierSubmitting, setIsCashierSubmitting] = useState(false);
  const [showCashierLogin, setShowCashierLogin] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void login();
  }

  async function onCashierSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCashierError(null);
    setIsCashierSubmitting(true);

    if (
      !cashierCode.trim() ||
      !cashierPin.trim() ||
      !cashierTenantSlug.trim()
    ) {
      setCashierError("Completa los datos para iniciar sesión como cajero.");
      setIsCashierSubmitting(false);
      return;
    }

    try {
      const response = await cashierLogin({
        cashierCode: cashierCode.trim(),
        pin: cashierPin.trim(),
        tenantSlug: cashierTenantSlug.trim(),
      });

      window.location.assign(response.redirectTo);
    } catch (loginError) {
      setCashierError(getCashierLoginErrorMessage(loginError));
    } finally {
      setIsCashierSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 text-white">
      <div className="flex flex-col items-center gap-2 text-center">
        <img src="/logo.jpg" alt="Logo" className="h-10 w-10 rounded-md" />
        <h1 className="font-semibold text-3xl tracking-tight">
          Iniciar sesión
        </h1>
        <p className="max-w-xs text-sm text-slate-300">
          Entra con WorkOS o con tus credenciales de cajero para acceder al
          sistema.
        </p>
      </div>
      {displayedError ? (
        <div
          className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200 text-sm"
          role="alert"
        >
          {displayedError}
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="grid gap-4">
        <Button
          type="submit"
          className="w-full bg-white text-slate-950 hover:bg-slate-100"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Abriendo WorkOS..." : "Continuar con WorkOS"}
        </Button>
      </form>
      <Separator className="bg-white/10" />
      <Button
        type="button"
        className="w-full border border-white/10 bg-white/5 text-white hover:bg-white/10"
        aria-controls="cashier-login-panel"
        aria-expanded={showCashierLogin}
        onClick={() => setShowCashierLogin((current) => !current)}
        variant="outline"
      >
        {showCashierLogin
          ? "Ocultar acceso de cajero"
          : "Inicia sesión si eres cajero"}
      </Button>
      {showCashierLogin ? (
        <form
          id="cashier-login-panel"
          onSubmit={onCashierSubmit}
          className="grid gap-4 rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-inner"
        >
          <p className="text-sm text-slate-300">
            Ingresa el área de trabajo, tu código y tu PIN.
          </p>
          <div className="space-y-2">
            <Label htmlFor="cashier-tenant">Área de trabajo</Label>
            <Input
              autoComplete="off"
              id="cashier-tenant"
              placeholder="Mi área de trabajo"
              value={cashierTenantSlug}
              onChange={(event) => setCashierTenantSlug(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cashier-code">Código de cajero</Label>
            <Input
              autoComplete="off"
              id="cashier-code"
              placeholder="CJ-123456"
              value={cashierCode}
              onChange={(event) => setCashierCode(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cashier-pin">PIN</Label>
            <Input
              autoComplete="off"
              id="cashier-pin"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              type="password"
              value={cashierPin}
              onChange={(event) =>
                setCashierPin(event.target.value.replaceAll(/\D/gu, ""))
              }
            />
          </div>
          {cashierError ? (
            <div
              className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-200 text-sm"
              role="alert"
            >
              {cashierError}
            </div>
          ) : null}
          <Button
            type="submit"
            className="w-full border border-white/10 bg-white/5 text-white hover:bg-white/10"
            disabled={isCashierSubmitting}
          >
            {isCashierSubmitting
              ? "Ingresando cajero..."
              : "Entrar como cajero"}
          </Button>
        </form>
      ) : null}
      <p className="text-center text-sm text-slate-400">
        ¿Todavía no tienes cuenta?{" "}
        <Link
          to="/register"
          className="font-medium text-white underline underline-offset-4 hover:text-slate-200"
        >
          Regístrate
        </Link>
      </p>
    </div>
  );
}
