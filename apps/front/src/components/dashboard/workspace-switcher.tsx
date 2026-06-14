import { ChevronsUpDown } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardPanel } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function WorkspaceSwitcher() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" className="w-full justify-start gap-2 px-2" />
        }
      >
        <Avatar className="size-6">
          <AvatarFallback className="text-xs">W</AvatarFallback>
        </Avatar>
        <span className="truncate font-medium text-sm">Workspace</span>
        <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" side="bottom" align="start">
        <Card>
          <CardPanel className="p-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-8">
                <AvatarFallback>W</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium text-sm">Workspace</span>
                <span className="text-muted-foreground text-xs">Free Plan</span>
              </div>
            </div>
          </CardPanel>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
