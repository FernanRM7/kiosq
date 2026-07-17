import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { request } from "@/lib/api";
import type { ApiClientError } from "@/lib/api";

interface CashierUser {
  id: string;
  name: string;
}

const TENANT_SLUG =
  (import.meta.env["VITE_KIOSK_TENANT_SLUG"] as string | undefined) ?? "";

export function CashierLoginForm() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"select" | "pin">("select");
  const [selectedCashier, setSelectedCashier] = useState<CashierUser | null>(
    null,
  );
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [cashiers, setCashiers] = useState<CashierUser[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!TENANT_SLUG) {
      setError(
        "El kiosko no está configurado. Contacta al administrador.",
      );
      setFetching(false);
      return;
    }

    request<CashierUser[]>(`/workspaces/${TENANT_SLUG}/cashiers`)
      .then(setCashiers)
      .catch(() => {
        setError("No se pudo obtener la lista de dependientes.");
      })
      .finally(() => setFetching(false));
  }, []);

  const handleSelect = (cashier: CashierUser) => {
    setSelectedCashier(cashier);
    setStep("pin");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCashier) {
      return;
    }

    if (!/^\d{4,6}$/.test(pin)) {
      setError("El PIN debe tener 4-6 dígitos numéricos");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await request<{ redirectTo: string }>("/auth/pin", {
        data: { pin, userId: selectedCashier.id },
        method: "POST",
      });
      navigate(result.redirectTo);
    } catch (submitError) {
      setError(
        (submitError as ApiClientError).message ?? "PIN incorrecto",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {step === "select" ? "Selecciona tu cuenta" : "Ingresa tu PIN"}
        </CardTitle>
        <CardDescription>
          {step === "select"
            ? "Elige tu nombre de la lista para continuar."
            : `Bienvenido, ${selectedCashier?.name}. Ingresa tu PIN de ${TENANT_SLUG}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fetching && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        )}

        {error && !fetching && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        {!fetching && step === "select" && cashiers.length > 0 && (
          <div className="space-y-2">
            {cashiers.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                className="h-12 w-full justify-start px-4 font-normal"
                onClick={() => handleSelect(c)}
              >
                {c.name}
              </Button>
            ))}
          </div>
        )}

        {!fetching && step === "select" && cashiers.length === 0 && !error && (
          <p className="text-center text-muted-foreground text-sm">
            No hay dependientes activos en este kiosko.
          </p>
        )}

        {step === "pin" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              inputMode="numeric"
              placeholder="PIN de 4-6 dígitos"
              maxLength={6}
              autoFocus
              disabled={loading}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={loading}
                onClick={() => {
                  setStep("select");
                  setPin("");
                  setSelectedCashier(null);
                  setError(null);
                }}
              >
                Volver
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Ingresando..." : "Entrar"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
