import { LogOut } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardPanel } from "@/components/ui/card";
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
        <Avatar className="size-6">
          <AvatarFallback className="text-xs">U</AvatarFallback>
        </Avatar>
        <span className="truncate font-medium text-sm">User Name</span>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" side="top" align="start">
        <Card>
          <CardPanel className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="size-8">
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">User Name</span>
                  <span className="text-muted-foreground text-xs">
                    user@example.com
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon-sm">
                <LogOut className="size-4" />
                <span className="sr-only">Logout</span>
              </Button>
            </div>
          </CardPanel>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
