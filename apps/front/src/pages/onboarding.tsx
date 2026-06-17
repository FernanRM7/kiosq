import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";
import { useAuth } from "@/hooks/use-auth";
import { getMyTenant } from "@/lib/auth";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { status } = useAuth();

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    async function checkTenant() {
      try {
        const result = await getMyTenant();
        if (result?.tenant) {
          navigate("/dashboard", { replace: true });
        }
      } catch {
        // Continue to show onboarding dialog
      }
    }

    void checkTenant();
  }, [navigate, status]);

  return <OnboardingDialog />;
}
