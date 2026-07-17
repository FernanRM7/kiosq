import { CashierLoginForm } from "@/components/auth/cashier-login-form";

export default function CashierLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-bold text-2xl tracking-tight">Kiosq</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Acceso para dependientes
          </p>
        </div>
        <CashierLoginForm />
      </div>
    </div>
  );
}
