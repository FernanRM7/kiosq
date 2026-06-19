import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContentRight,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { listProducts } from "@/lib/products";
import type { Product } from "@/lib/products";
import { createSale, SALES_CHANGED_EVENT } from "@/lib/sales";

interface CartItem {
  productId: string;
  name: string;
  price: number;
  taxRate: number;
  quantity: number;
  maxStock: number;
}

export function SalesDrawer() {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successSale, setSuccessSale] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const data = await listProducts();
      setProducts(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchProducts();
    }
  }, [open, fetchProducts]);

  const filteredProducts = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) {
      return products;
    }

    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query)
    );
  }, [products, search]);

  const cartProductIds = useMemo(
    () => new Set(cart.map((item) => item.productId)),
    [cart]
  );

  function addToCart(product: Product) {
    if (cartProductIds.has(product.id)) {
      return;
    }

    setCart((prev) => [
      ...prev,
      {
        maxStock: product.totalStock,
        name: product.name,
        price: product.price,
        productId: product.id,
        quantity: 1,
        taxRate: product.taxRate,
      },
    ]);
    setSearch("");
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((items) =>
      items
        .map((item) => {
          if (item.productId !== productId) {
            return item;
          }

          const newQuantity = item.quantity + delta;

          if (newQuantity > item.maxStock || newQuantity < 0) {
            return item;
          }

          return { ...item, quantity: newQuantity };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(productId: string) {
    setCart((items) => items.filter((item) => item.productId !== productId));
  }

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const taxAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity * item.taxRate,
    0
  );
  const total = subtotal + taxAmount;

  async function completeSale() {
    if (cart.length === 0) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await createSale({
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        paymentMethod: "CASH",
      });

      setCart([]);
      setOpen(false);
      setSuccessSale(true);
      window.dispatchEvent(new Event(SALES_CHANGED_EVENT));
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo completar la venta"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
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
            <DrawerTitle>Nueva Venta</DrawerTitle>
            <DrawerDescription>
              Agrega productos y completa la venta
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-3 px-6">
            <div className="relative">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {search && filteredProducts.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border">
                {filteredProducts.map((product) => {
                  const alreadyInCart = cartProductIds.has(product.id);

                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={alreadyInCart}
                      onClick={() => addToCart(product)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{product.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {product.sku} — Stock: {product.totalStock}
                        </span>
                      </div>
                      <span className="tabular-nums">
                        ${product.price.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {cart.map((item) => (
              <div
                key={item.productId}
                className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{item.name}</span>
                  <span className="text-muted-foreground text-xs">
                    ${item.price.toFixed(2)} c/u — IVA{" "}
                    {Math.round(item.taxRate * 100)}%
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Stock max: {item.maxStock}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-xs"
                    onClick={() => updateQuantity(item.productId, -1)}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-6 text-center text-sm tabular-nums">
                    {item.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-xs"
                    onClick={() => updateQuantity(item.productId, 1)}
                    disabled={item.quantity >= item.maxStock}
                  >
                    <Plus className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeItem(item.productId)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}

            {cart.length === 0 && !search && (
              <p className="py-8 text-center text-muted-foreground text-sm">
                Busca y agrega productos para iniciar la venta
              </p>
            )}
          </div>

          {cart.length > 0 && (
            <DrawerFooter>
              <Separator />
              <div className="flex flex-col gap-1 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IVA</span>
                  <span className="tabular-nums">${taxAmount.toFixed(2)}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-semibold text-sm">
                  <span>Total</span>
                  <span className="tabular-nums">${total.toFixed(2)}</span>
                </div>
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button
                className="mt-2 w-full"
                onClick={completeSale}
                disabled={loading || cart.length === 0}
              >
                {loading ? "Procesando..." : "Completar Venta"}
              </Button>
            </DrawerFooter>
          )}
        </DrawerContentRight>
      </Drawer>

      <Dialog open={successSale} onOpenChange={setSuccessSale}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Venta completada</DialogTitle>
            <DialogDescription>
              La venta se registró correctamente. Puedes verla en la página de
              Ventas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setSuccessSale(false)}>Aceptar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
