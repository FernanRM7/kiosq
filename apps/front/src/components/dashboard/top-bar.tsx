import { PlusCircle, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function TopBar() {
  return (
    <header className="flex h-13 m-0.5 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex flex-1 items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-8" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="w-28">
          <PlusCircle className="size-4" />
          <span>Sales</span>
        </Button>
        <Button variant="default" size="sm" className="w-28">
          <PlusCircle className="size-4" />
          <span>Product</span>
        </Button>
      </div>
    </header>
  );
}
