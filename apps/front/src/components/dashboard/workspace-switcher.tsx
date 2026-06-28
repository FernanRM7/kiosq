import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { getMyTenant, listTenants, switchTenant } from "@/lib/auth";
import type { TenantListItem } from "@/lib/auth";

export function WorkspaceSwitcher() {
  const { user } = useAuth();
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [activeTenantName, setActiveTenantName] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<TenantListItem[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const result = await getMyTenant();
      if (result?.tenant) {
        setActiveTenantId(result.tenant.id);
        setActiveTenantName(result.tenant.name);
      }
    } catch {
      // silent
    }

    try {
      const allTenants = await listTenants();
      setWorkspaces(allTenants);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    void fetchWorkspaces();
  }, [fetchWorkspaces]);

  async function handleSwitch(tenantId: string) {
    if (tenantId === activeTenantId) {
      setPopoverOpen(false);
      return;
    }

    setSwitching(tenantId);

    try {
      await switchTenant(tenantId);
      setPopoverOpen(false);
      window.location.replace("/dashboard");
    } catch {
      // silently fail
    } finally {
      setSwitching(null);
    }
  }

  function handleCreateWorkspace() {
    setPopoverOpen(false);
    setShowOnboarding(true);
  }

  function handleOnboardingComplete(tenantName: string) {
    setShowOnboarding(false);
    if (tenantName) {
      void fetchWorkspaces();
    }
  }

  const workspaceLabel =
    activeTenantName ?? user?.organizationId ?? "Workspace";
  const workspaceMeta = activeTenantName ? "Plan activo" : "Plan gratuito";

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 rounded-[2rem] border border-sidebar-border/30 bg-sidebar/70 backdrop-blur-xl px-3 py-3 text-sm shadow-2xl shadow-black/10 hover:bg-sidebar/90"
            />
          }
        >
          <Avatar className="size-7 rounded-2xl ring-1 ring-sidebar-border/60">
            <img
              src="/logo.jpg"
              alt="Workspace"
              className="size-full rounded-2xl object-cover"
            />
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-sm text-sidebar-foreground">
              {workspaceLabel}
            </span>
            <span className="truncate text-xs text-sidebar-foreground/60">
              {workspaceMeta}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent className="w-60" side="bottom" align="end">
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
            <Avatar className="size-8 rounded-md">
              <img
                src="/logo.jpg"
                alt="Workspace"
                className="size-full rounded-md object-cover"
              />
            </Avatar>
            <div className="flex flex-col">
              <span className="max-w-40 truncate font-medium text-sm">
                {workspaceLabel}
              </span>
              <span className="text-muted-foreground text-xs">
                {workspaceMeta}
              </span>
            </div>
          </div>
          <Separator className="my-1" />
          <div className="max-h-48 overflow-y-auto">
            {workspaces.map((ws) => {
              const isActive = ws.id === activeTenantId;

              return (
                <button
                  key={ws.id}
                  type="button"
                  disabled={switching !== null}
                  onClick={() => handleSwitch(ws.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                >
                  <Avatar className="size-5 shrink-0 rounded">
                    <img
                      src="/logo.jpg"
                      alt=""
                      className="size-full rounded object-cover"
                    />
                  </Avatar>
                  <div className="flex flex-1 flex-col truncate">
                    <span className="truncate font-medium text-sm">
                      {ws.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {ws.role === "ADMIN" ? "Admin" : ws.role}
                    </span>
                  </div>
                  {isActive && (
                    <Check className="size-4 shrink-0 text-primary" />
                  )}
                  {switching === ws.id && (
                    <span className="shrink-0 text-muted-foreground text-xs">
                      ...
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Separator className="my-1" />
          <Button
            variant="ghost"
            className="mt-1 w-full justify-start gap-2 px-2"
            onClick={handleCreateWorkspace}
          >
            <Plus className="size-4" />
            <span className="text-sm">Nuevo workspace</span>
          </Button>
        </PopoverContent>
      </Popover>

      {showOnboarding && (
        <OnboardingDialog
          open={showOnboarding}
          onComplete={handleOnboardingComplete}
        />
      )}
    </>
  );
}
