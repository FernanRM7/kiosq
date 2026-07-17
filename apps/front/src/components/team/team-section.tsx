import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateCashierDialog } from "@/components/team/create-cashier-dialog";
import { InviteManagerDialog } from "@/components/team/invite-manager-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useTeam } from "@/hooks/queries/use-team";
import { canManageSettings } from "@/lib/access";
import { getRoleLabel } from "@/lib/access";

export function TeamSection() {
  const { user } = useAuth();
  const { data: members = [], isLoading } = useTeam();
  const canManage = canManageSettings(user?.role);
  const [cashierDialogOpen, setCashierDialogOpen] = useState(false);
  const [managerDialogOpen, setManagerDialogOpen] = useState(false);

  if (!canManage) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Equipo</CardTitle>
            <CardDescription>
              Miembros de tu workspace y sus roles.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setManagerDialogOpen(true)}>
              Invitar Manager
            </Button>
            <Button onClick={() => setCashierDialogOpen(true)}>
              Agregar Dependiente
            </Button>
          </div>
        </CardHeader>
        <CardPanel>
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-9 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && members.length === 0 && (
            <p className="py-4 text-center text-muted-foreground text-sm">
              No hay miembros en el equipo. Agrega dependientes desde el botón
              superior.
            </p>
          )}

          {!isLoading && members.length > 0 && (
            <div className="space-y-1">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-sm">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-sm">
                        {member.name}
                      </p>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                        {getRoleLabel(member.role)}
                      </span>
                      {member.status === "PENDING" && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 text-xs dark:bg-amber-900/20 dark:text-amber-400">
                          Pendiente
                        </span>
                      )}
                      {member.status === "DISABLED" && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="truncate text-muted-foreground text-xs">
                      {member.email ?? "Sin correo"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardPanel>
      </Card>

      <CreateCashierDialog open={cashierDialogOpen} onOpenChange={setCashierDialogOpen} />
      <InviteManagerDialog open={managerDialogOpen} onOpenChange={setManagerDialogOpen} />
    </>
  );
}
