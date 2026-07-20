import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";

import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { useMyTenant, useTenants } from "@/hooks/queries/use-tenants";
import { useAuth } from "@/hooks/use-auth";
import { canSwitchWorkspace } from "@/lib/access";
import { switchTenant } from "@/lib/auth";
import type { TenantListItem } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher() {
  const { user } = useAuth();
  const { state } = useSidebar();
  const canSwitch = canSwitchWorkspace(user?.role);
  const { data: myTenant } = useMyTenant(canSwitch);
  const { data: tenants = [] } = useTenants(canSwitch);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const activeTenantId = myTenant?.tenant?.id ?? null;
  const activeTenantName = myTenant?.tenant?.name ?? null;
  const workspaces = tenants as TenantListItem[];

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
    } catch (error) {
      console.error("[Workspace] Failed to switch tenant", error);
    } finally {
      setSwitching(null);
    }
  }

  function handleCreateWorkspace() {
    setPopoverOpen(false);
    setShowOnboarding(true);
  }

  function handleOnboardingComplete(_tenantName: string) {
    setShowOnboarding(false);
  }

  const workspaceLabel =
    activeTenantName ?? user?.organizationId ?? "Workspace";
  const workspaceMeta = activeTenantName ? "Plan activo" : "Plan gratuito";

  if (!canSwitch) {
    return null;
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              className={cn(
                "w-full rounded-[2rem] border border-sidebar-border/30 bg-sidebar/70 backdrop-blur-xl py-3 text-sm shadow-2xl shadow-black/10 hover:bg-sidebar/90",
                state === "collapsed"
                  ? "justify-center px-2"
                  : "justify-start gap-3 px-3"
              )}
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

          {state !== "collapsed" && (
            <>
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold text-sm text-sidebar-foreground">
                  {workspaceLabel}
                </span>

                <span className="truncate text-xs text-sidebar-foreground/60">
                  {workspaceMeta}
                </span>
              </div>

              <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
            </>
          )}
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
