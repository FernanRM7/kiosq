import { LogOut, ChevronsUpDown } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";

function getDisplayName(user: NonNullable<ReturnType<typeof useAuth>["user"]>) {
  const name =
    user.name || [user.firstName, user.lastName].filter(Boolean).join(" ");

  return name || user.email || "Usuario";
}

function getInitials(user: NonNullable<ReturnType<typeof useAuth>["user"]>) {
  const source = getDisplayName(user);
  const parts = source.split(/[.\s@_-]+/u).filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function UserNav() {
  const { error, logout, pendingAction, user } = useAuth();
  const isLoggingOut = pendingAction === "logout";
  const displayName = user ? getDisplayName(user) : "Usuario";
  const initials = user ? getInitials(user) : "U";

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-[2rem] border border-sidebar-border/30 bg-sidebar/70 backdrop-blur-xl px-3 py-3 text-sm shadow-2xl shadow-black/10 hover:bg-sidebar/90"
          />
        }
      >
        <Avatar className="size-7 rounded-full ring-1 ring-sidebar-border/60">
          <AvatarFallback className="rounded-full text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-sm text-sidebar-foreground">
            {displayName}
          </span>
          <span className="truncate text-xs text-sidebar-foreground/60">
            Perfil
          </span>
        </div>
        <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" side="top" align="start">
        {user ? (
          <div className="px-2 py-1.5">
            <p className="truncate font-medium text-sm">{displayName}</p>
            <p className="truncate text-muted-foreground text-xs">
              {user.email}
            </p>
          </div>
        ) : null}
        {error ? (
          <p className="px-2 py-1 text-destructive text-xs" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2"
          disabled={isLoggingOut}
          onClick={() => {
            void logout();
          }}
        >
          <LogOut className="size-4" />
          <span className="text-sm">
            {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
          </span>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
