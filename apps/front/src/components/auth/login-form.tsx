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
    <div className="flex flex-col gap-6 text-white">
      <div className="flex flex-col items-center gap-2 text-center">
        <img src="/logo.jpg" alt="Logo" className="h-10 w-10 rounded-md" />
        <h1 className="font-semibold text-3xl tracking-tight">Sign in</h1>
        <p className="max-w-xs text-sm text-slate-300">
          Continue with WorkOS AuthKit to access your account.
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
          {isSubmitting ? "Opening WorkOS..." : "Continue with WorkOS"}
        </Button>
      </form>
      <p className="text-center text-sm text-slate-400">
        Don&apos;t have an account?{" "}
        <Link
          to="/register"
          className="font-medium text-white underline underline-offset-4 hover:text-slate-200"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
