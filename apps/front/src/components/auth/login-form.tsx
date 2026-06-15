import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm() {
  const navigate = useNavigate();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    navigate("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <img src="/logo.jpg" alt="Logo" className="h-10 w-10 rounded-md" />
        <h1 className="font-semibold text-2xl tracking-tight">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Enter your credentials to access your account
        </p>
      </div>
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="name@example.com" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" placeholder="••••••••" />
        </div>
        <Button type="submit" className="w-full">
          Sign in
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
