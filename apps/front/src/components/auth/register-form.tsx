import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function RegisterForm() {
  const { error, pendingAction, register } = useAuth();
  const isSubmitting = pendingAction === "register";

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void register();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <img src="/logo.jpg" alt="Logo" className="h-10 w-10 rounded-md" />
        <h1 className="font-semibold text-2xl tracking-tight">Crear cuenta</h1>
        <p className="text-muted-foreground text-sm">
          WorkOS AuthKit te guiará en el proceso de registro
        </p>
      </div>
      {error ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="grid gap-4">
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Abriendo WorkOS..." : "Continuar con WorkOS"}
        </Button>
      </form>
      <p className="text-center text-muted-foreground text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link
          to="/login"
          className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
