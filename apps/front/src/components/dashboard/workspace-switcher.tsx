/* eslint-disable complexity, no-nested-ternary, unicorn/no-nested-ternary */
import { Check, ChevronsUpDown, PencilLine, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { useDeleteTenant } from "@/hooks/mutations/use-delete-tenant";
import { useUpdateTenant } from "@/hooks/mutations/use-update-tenant";
import { useMyTenant, useTenants } from "@/hooks/queries/use-tenants";
import { useAuth } from "@/hooks/use-auth";
import { canSwitchWorkspace } from "@/lib/access";
import { switchTenant } from "@/lib/auth";
import type { MyTenantData, TenantListItem } from "@/lib/auth";
import { cn } from "@/lib/utils";

type TenantData = NonNullable<MyTenantData["tenant"]>;

function getRoleLabel(role: string): string {
  switch (role) {
    case "ADMIN": {
      return "Administrador";
    }
    case "MANAGER": {
      return "Gerente";
    }
    case "CASHIER": {
      return "Cajero";
    }
    default: {
      return role;
    }
  }
}

function getCashierLimit(tenant: TenantData | null): number {
  return Math.max((tenant?.plan?.maxUsers ?? 3) - 1, 0);
}

interface WorkspaceManagementMenuProps {
  canManageWorkspace: boolean;
  onClosePopover: () => void;
  onCreateWorkspace: () => void;
  roleLabel: string;
  tenant: TenantData | null;
  workspaceLabel: string;
  workspaceMeta: string;
}

function WorkspaceManagementMenu({
  canManageWorkspace,
  onClosePopover,
  onCreateWorkspace,
  roleLabel,
  tenant,
  workspaceLabel,
  workspaceMeta,
}: WorkspaceManagementMenuProps) {
  const navigate = useNavigate();
  const updateTenantMutation = useUpdateTenant();
  const deleteTenantMutation = useDeleteTenant();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditReviewOpen, setIsEditReviewOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [pendingEditName, setPendingEditName] = useState("");
  const [isDeleteIntroOpen, setIsDeleteIntroOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState("");

  function handleOpenEditWorkspace() {
    if (!tenant || !canManageWorkspace) {
      return;
    }

    updateTenantMutation.reset();
    setEditName(tenant.name);
    onClosePopover();
    setIsEditOpen(true);
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = editName.trim();

    if (!trimmedName || !tenant) {
      return;
    }

    setPendingEditName(trimmedName);
    setIsEditOpen(false);
    setIsEditReviewOpen(true);
  }

  function handleConfirmEdit() {
    if (!pendingEditName) {
      return;
    }

    updateTenantMutation.mutate(
      { name: pendingEditName },
      {
        onSuccess: () => {
          setIsEditReviewOpen(false);
          setPendingEditName("");
          setEditName("");
        },
      }
    );
  }

  function handleOpenDeleteIntro() {
    if (!tenant || !canManageWorkspace) {
      return;
    }

    deleteTenantMutation.reset();
    setDeleteConfirmationName("");
    onClosePopover();
    setIsDeleteIntroOpen(true);
  }

  function handleDeleteIntroConfirm() {
    setIsDeleteIntroOpen(false);
    setDeleteConfirmationName("");
    setIsDeleteConfirmOpen(true);
  }

  function handleDeleteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenant) {
      return;
    }

    deleteTenantMutation.mutate(
      { confirmationName: deleteConfirmationName.trim() },
      {
        onSuccess: () => {
          setIsDeleteConfirmOpen(false);
          setDeleteConfirmationName("");
          navigate("/onboarding", { replace: true });
        },
      }
    );
  }

  return (
    <>
      {tenant ? (
        <>
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
            <Avatar className="size-8 rounded-md">
              <img
                src="/logo.jpg"
                alt="Negocio"
                className="size-full rounded-md object-cover"
              />
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-sm">
                {workspaceLabel}
              </span>
              <span className="truncate text-muted-foreground text-xs">
                {workspaceMeta}
              </span>
            </div>
          </div>
          <Separator className="my-1" />
          <div className="space-y-1">
            <p className="px-2 text-muted-foreground text-xs">
              {roleLabel} · Solo puedes tener un negocio activo.
            </p>
            {canManageWorkspace ? (
              <>
                <Button
                  className="w-full justify-start gap-2 px-2"
                  onClick={handleOpenEditWorkspace}
                  variant="ghost"
                >
                  <PencilLine className="size-4" />
                  <span className="text-sm">Editar negocio</span>
                </Button>
                <Button
                  className="w-full justify-start gap-2 px-2 text-destructive hover:text-destructive"
                  onClick={handleOpenDeleteIntro}
                  variant="ghost"
                >
                  <Trash2 className="size-4" />
                  <span className="text-sm">Eliminar negocio</span>
                </Button>
              </>
            ) : (
              <p className="px-2 py-1 text-muted-foreground text-xs">
                Solo el dueño puede editar o eliminar el negocio.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="px-2 py-1.5">
            <p className="font-medium text-sm">Sin negocio activo</p>
            <p className="text-muted-foreground text-xs">
              {canManageWorkspace
                ? "Crea tu primer negocio para empezar."
                : "Pide al dueño que registre el negocio."}
            </p>
          </div>
          <Separator className="my-1" />
          {canManageWorkspace ? (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 px-2"
              onClick={() => {
                onClosePopover();
                onCreateWorkspace();
              }}
            >
              <Plus className="size-4" />
              <span className="text-sm">Nuevo negocio</span>
            </Button>
          ) : (
            <p className="px-2 py-1 text-muted-foreground text-xs">
              Tu cuenta de cajero no puede crear negocios.
            </p>
          )}
        </>
      )}

      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsEditOpen(false);
            setEditName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar negocio</DialogTitle>
            <DialogDescription>
              Cambia el nombre del negocio. Luego te pediremos confirmarlo una
              vez más.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleEditSubmit}>
            <div className="space-y-2 text-left">
              <Label htmlFor="workspace-name">Nombre del negocio</Label>
              <Input
                id="workspace-name"
                minLength={2}
                required
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
            </div>
            {updateTenantMutation.error instanceof Error ? (
              <p className="text-destructive text-sm" role="alert">
                {updateTenantMutation.error.message}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false);
                  setEditName("");
                }}
              >
                Cancelar
              </Button>
              <Button type="submit">Continuar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditReviewOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsEditReviewOpen(false);
            setPendingEditName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar cambio</DialogTitle>
            <DialogDescription>
              Revisa el nombre nuevo antes de aplicarlo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Nombre actual:{" "}
              <span className="font-medium text-foreground">
                {tenant?.name ?? "Sin negocio"}
              </span>
            </p>
            <p className="text-muted-foreground">
              Nombre nuevo:{" "}
              <span className="font-medium text-foreground">
                {pendingEditName}
              </span>
            </p>
          </div>
          {updateTenantMutation.error instanceof Error ? (
            <p className="text-destructive text-sm" role="alert">
              {updateTenantMutation.error.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEditReviewOpen(false);
                setIsEditOpen(true);
              }}
            >
              Volver
            </Button>
            <Button
              disabled={updateTenantMutation.isPending}
              onClick={() => {
                handleConfirmEdit();
              }}
              type="button"
            >
              {updateTenantMutation.isPending ? "Guardando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteIntroOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsDeleteIntroOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar negocio</DialogTitle>
            <DialogDescription>
              Esta acción cancela el negocio y oculta su información. Luego te
              pediremos una segunda confirmación.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteIntroOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleDeleteIntroConfirm}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsDeleteConfirmOpen(false);
            setDeleteConfirmationName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmación final</DialogTitle>
            <DialogDescription>
              Escribe el nombre exacto del negocio para eliminarlo.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleDeleteSubmit}>
            <div className="space-y-2 text-left">
              <Label htmlFor="delete-confirmation-name">
                Nombre del negocio
              </Label>
              <Input
                id="delete-confirmation-name"
                minLength={2}
                required
                value={deleteConfirmationName}
                onChange={(event) =>
                  setDeleteConfirmationName(event.target.value)
                }
              />
            </div>
            {deleteTenantMutation.error instanceof Error ? (
              <p className="text-destructive text-sm" role="alert">
                {deleteTenantMutation.error.message}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setDeleteConfirmationName("");
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={
                  deleteTenantMutation.isPending ||
                  deleteConfirmationName.trim().toLowerCase() !==
                    tenant?.name?.trim().toLowerCase()
                }
                type="submit"
              >
                {deleteTenantMutation.isPending ? "Eliminando..." : "Eliminar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function WorkspaceSwitcher() {
  const { status, user } = useAuth();
  const { state } = useSidebar();
  const canSwitch = canSwitchWorkspace(user?.role);
  const canManageWorkspace = user?.role ? user.role !== "CASHIER" : false;
  const { data: myTenant } = useMyTenant(status === "authenticated");
  const { data: tenants = [] } = useTenants(
    status === "authenticated" && canSwitch
  );
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const activeTenantId = myTenant?.tenant?.id ?? null;
  const activeTenantName = myTenant?.tenant?.name ?? null;
  const tenant = myTenant?.tenant ?? null;
  const workspaces = tenants as TenantListItem[];
  const cashierLimit = getCashierLimit(tenant);
  const roleLabel = getRoleLabel(myTenant?.role ?? user?.role ?? "ADMIN");

  const workspaceLabel = activeTenantName ?? "Sin negocio activo";
  const workspaceMeta = tenant
    ? `Plan ${tenant.plan?.name ?? "activo"} · ${cashierLimit} cajeros`
    : canManageWorkspace
      ? "Aún no tienes un negocio"
      : "Pide al dueño que registre el negocio.";

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

  function closePopover() {
    setPopoverOpen(false);
  }

  if (status !== "authenticated" || !user) {
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
              alt="Negocio"
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
        <PopoverContent className="w-80" side="bottom" align="end">
          {canSwitch ? (
            <>
              <div className="max-h-52 overflow-y-auto">
                {workspaces.length === 0 ? (
                  <p className="px-2 py-1.5 text-muted-foreground text-sm">
                    No tienes workspaces disponibles.
                  </p>
                ) : (
                  workspaces.map((ws) => {
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
                            {getRoleLabel(ws.role)}
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
                  })
                )}
              </div>
              <Separator className="my-1" />
            </>
          ) : null}

          <WorkspaceManagementMenu
            canManageWorkspace={canManageWorkspace}
            onClosePopover={closePopover}
            onCreateWorkspace={handleCreateWorkspace}
            roleLabel={roleLabel}
            tenant={tenant}
            workspaceLabel={workspaceLabel}
            workspaceMeta={workspaceMeta}
          />
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
