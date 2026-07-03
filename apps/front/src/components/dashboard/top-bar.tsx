import { Plus, Search } from "lucide-react";
import { useState } from "react";

import { ProductDialog } from "@/components/dashboard/product-dialog";
import { SalesDrawer } from "@/components/dashboard/sales-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSync } from "@/contexts/sync.context";

export function TopBar() {
  const [productOpen, setProductOpen] = useState(false);

  return (
    <>
      <header className="flex h-13 m-0.5 shrink-0 items-center gap-2 border-b border-b-zinc-200 px-4">
        <SidebarTrigger className="" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex flex-1 items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-8" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SalesDrawer />
          <SyncBadge />
          <Button
            variant="default"
            size="sm"
            className="w-28"
            onClick={() => setProductOpen(true)}
          >
            <Plus className="size-4" />
            <span>Product</span>
          </Button>
        </div>
      </header>
      <ProductDialog open={productOpen} onOpenChange={setProductOpen} />
    </>
  );
}

function SyncBadge() {
  const { isOnline, pendingCount, status } = useSync();
  return (
    <div className="flex items-center gap-2 text-sm mr-2">
      <div
        className={`px-2 py-1 rounded ${isOnline ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"}`}
      >
        {isOnline ? "Online" : "Offline"}
      </div>
      {pendingCount > 0 && (
        <div className="px-2 py-1 rounded bg-red-100 text-red-800">
          {pendingCount} pending
        </div>
      )}
      {status === "syncing" && (
        <div className="px-2 py-1 rounded bg-blue-100 text-blue-800">
          Syncing…
        </div>
      )}
    </div>
  );
}
