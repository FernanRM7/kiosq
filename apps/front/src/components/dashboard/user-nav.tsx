import { LogOut, ChevronsUpDown } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function UserNav() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" className="w-full justify-start gap-2 px-2" />
        }
      >
        <Avatar className="size-6 rounded-md">
          <AvatarFallback className="rounded-md text-xs">U</AvatarFallback>
        </Avatar>
        <span className="truncate font-medium text-sm">User Name</span>
        <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" side="top" align="start">
        <Button variant="ghost" className="w-full justify-start gap-2 px-2">
          <LogOut className="size-4" />
          <span className="text-sm">Log out</span>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
