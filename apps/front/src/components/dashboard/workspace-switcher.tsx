import { ChevronsUpDown, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { getMyTenant } from "@/lib/auth";

export function WorkspaceSwitcher() {
  const { user } = useAuth();
  const [tenantName, setTenantName] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTenant() {
      try {
        const result = await getMyTenant();
        const tenant = (result as { tenant?: { name: string } } | undefined)
          ?.tenant;
        if (tenant?.name) {
          setTenantName(tenant.name);
        }
      } catch {
        // User may not have a tenant yet
      }
    }

    void fetchTenant();
  }, []);

  const workspaceLabel = tenantName ?? user?.organizationId ?? "Workspace";
  const workspaceMeta = tenantName ? "Active plan" : "Free Plan";

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" className="w-full justify-start gap-2 px-2" />
        }
      >
        <Avatar className="size-6 rounded-md">
          <img
            src="/logo.jpg"
            alt="Workspace"
            className="size-full rounded-md object-cover"
          />
        </Avatar>
        <span className="truncate font-medium text-sm">{workspaceLabel}</span>
        <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-56" side="bottom" align="end">
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
        <Separator />
        <Button
          variant="ghost"
          className="mt-1 w-full justify-start gap-2 px-2"
        >
          <Plus className="size-4" />
          <span className="text-sm">New workspace</span>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
