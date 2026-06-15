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
          <div className="grid grid-cols-2 gap-4">
            <Empty
              title="Logo"
              description="Click to upload"
              className="aspect-square cursor-pointer"
            />
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="workspaceName">Workspace Name</Label>
                <Input id="workspaceName" placeholder="My Workspace" />
              </div>
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
