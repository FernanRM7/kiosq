import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContentRight,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { saleItems } from "@/data/sale-items";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export function SalesDrawer() {
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(saleItems);

  function updateQuantity(id: string, delta: number) {
    setCart((items) =>
      items
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(id: string) {
    setCart((items) => items.filter((item) => item.id !== id));
  }

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <Button
        variant="outline"
        size="sm"
        className="w-28"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        <span>Sales</span>
      </Button>
      <DrawerContentRight>
        <DrawerHeader>
          <DrawerTitle>Sales Checkout</DrawerTitle>
          <DrawerDescription>Review items before purchase</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 px-6">
          {cart.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="flex flex-col">
                <span className="font-medium text-sm">{item.name}</span>
                <span className="text-muted-foreground text-xs">
                  ${item.price.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-xs"
                  onClick={() => updateQuantity(item.id, -1)}
                >
                  <Minus className="size-3" />
                </Button>
                <span className="w-6 text-center text-sm tabular-nums">
                  {item.quantity}
                </span>
                <Button
                  variant="outline"
                  size="icon-xs"
                  onClick={() => updateQuantity(item.id, 1)}
                >
                  <Plus className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <DrawerFooter>
          <Separator />
          <div className="flex flex-col gap-1 pt-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax (10%)</span>
              <span className="tabular-nums">${tax.toFixed(2)}</span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between font-semibold text-sm">
              <span>Total</span>
              <span className="tabular-nums">${total.toFixed(2)}</span>
            </div>
          </div>
          <Button className="mt-2 w-full">Complete Sale</Button>
        </DrawerFooter>
      </DrawerContentRight>
    </Drawer>
  );
}
