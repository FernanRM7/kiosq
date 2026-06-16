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

export function OnboardingDialog() {
  const navigate = useNavigate();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    navigate("/dashboard");
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
                placeholder="Mi Local"
                className="text-center"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
