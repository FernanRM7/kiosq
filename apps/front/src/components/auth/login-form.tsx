import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function LoginForm() {
  const { error, login, pendingAction } = useAuth();
  const [searchParams] = useSearchParams();
  const callbackMessage = searchParams.get("message");
  const callbackError = searchParams.get("error");
  const displayedError =
    callbackMessage ??
    (callbackError ? "Authentication could not be completed." : error);
  const isSubmitting = pendingAction === "login";

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void login();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <img src="/logo.jpg" alt="Logo" className="h-10 w-10 rounded-md" />
        <h1 className="font-semibold text-2xl tracking-tight">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Continue with WorkOS AuthKit to access your account
        </p>
      </div>
      {displayedError ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm"
          role="alert"
        >
          {displayedError}
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="grid gap-4">
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Opening WorkOS..." : "Continue with WorkOS"}
        </Button>
      </form>
      <p className="text-center text-muted-foreground text-sm">
        Don&apos;t have an account?{" "}
        <Link
          to="/register"
          className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
