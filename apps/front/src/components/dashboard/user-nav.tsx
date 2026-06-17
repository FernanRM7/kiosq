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
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return name || user.email;
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
  const displayName = user ? getDisplayName(user) : "User";
  const initials = user ? getInitials(user) : "U";

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" className="w-full justify-start gap-2 px-2" />
        }
      >
        <Avatar className="size-6 rounded-md">
          <AvatarFallback className="rounded-md text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="truncate font-medium text-sm">{displayName}</span>
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
            {isLoggingOut ? "Logging out..." : "Log out"}
          </span>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
