import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTenant } from "@/lib/auth";

export function OnboardingDialog() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const form = e.target as HTMLFormElement;
      const data = new FormData(form);
      const workspaceName = data.get("workspaceName") as string;

      if (!workspaceName?.trim()) {
        setError("El nombre del local es obligatorio");
        setLoading(false);
        return;
      }

      await createTenant(workspaceName.trim());
      navigate("/dashboard");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Error al crear el workspace"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={() => navigate("/dashboard")}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Welcome</DialogTitle>
          <DialogDescription>
            Set up your workspace to get started.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="flex items-center gap-4">
            <Empty
              title="Logo"
              description="Click to upload"
              className="h-32 w-32 shrink-0 cursor-pointer p-4"
            />
            <div className="flex flex-1 flex-col items-center gap-2">
              <Label htmlFor="workspaceName" className="text-center">
                Nombre del Local
              </Label>
              <Input
                id="workspaceName"
                name="workspaceName"
                placeholder="Mi Local"
                className="text-center"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Continue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
