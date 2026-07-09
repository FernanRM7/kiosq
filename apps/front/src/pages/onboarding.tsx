import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";
import { useMyTenant } from "@/hooks/queries/use-tenants";
import { useAuth } from "@/hooks/use-auth";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { status } = useAuth();
  const { data: myTenant, isLoading } = useMyTenant();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (isLoading || status !== "authenticated") {
      return;
    }

    if (myTenant?.tenant) {
      navigate("/dashboard", { replace: true });
      return;
    }

    const timer = setTimeout(() => {
      setShowModal(true);
    }, 800);

    return () => clearTimeout(timer);
  }, [myTenant, isLoading, navigate, status]);

  if (status === "loading" || isLoading || !showModal) {
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
