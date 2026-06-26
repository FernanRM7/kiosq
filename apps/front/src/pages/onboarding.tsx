import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";
import { useAuth } from "@/hooks/use-auth";
import { getMyTenant } from "@/lib/auth";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { status } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    async function checkTenant() {
      try {
        const result = await getMyTenant();
        if (result?.tenant) {
          navigate("/dashboard", { replace: true });
        } else {
          // Small delay before showing the onboarding modal to make the transition feel smooth
          setTimeout(() => {
            setChecking(false);
          }, 800);
        }
      } catch (error) {
        console.error("[Onboarding] Failed to check tenant", error);
        setChecking(false);
      }
    }

    void checkTenant();
  }, [navigate, status]);

  if (status === "loading" || checking) {
    return (
      <div className="bg-background flex h-screen w-screen flex-col items-center justify-center gap-3">
        <div className="border-border border-t-primary h-8 w-8 animate-spin rounded-full border-2" />
        <p className="text-muted-foreground text-sm font-medium tracking-wide">
          Verificando tu espacio de trabajo...
        </p>
      </div>
    );
  }

  return <OnboardingDialog />;
}
