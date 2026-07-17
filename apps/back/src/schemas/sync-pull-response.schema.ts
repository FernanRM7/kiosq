import { ApiProperty } from "@nestjs/swagger";

class SyncPullSaleItemSchema {
  @ApiProperty({ description: "ID del item de venta", example: "item-1" })
  id: string;

  @ApiProperty({ description: "ID del producto", example: "prod-1" })
  productId: string;

  @ApiProperty({ description: "Cantidad vendida", example: 2 })
  quantity: number;

  @ApiProperty({ description: "Subtotal del item", example: 100 })
  subtotal: number;

  @ApiProperty({ description: "Tasa de impuesto (0-1)", example: 0.16 })
  taxRate: number;

  @ApiProperty({ description: "Precio unitario", example: 50 })
  unitPrice: number;
}

class SyncPullSaleSchema {
  @ApiProperty({ description: "ID de la venta", example: "sale-1" })
  id: string;

  @ApiProperty({ description: "ID offline (cliente)", example: "offline-abc" })
  offlineId: string;

  @ApiProperty({ description: "ID del tenant", example: "tenant-1" })
  tenantId: string;

  @ApiProperty({ description: "ID de la sucursal", example: "branch-1" })
  branchId: string;

  @ApiProperty({ description: "ID del usuario que registró la venta" })
  userId: string;

  @ApiProperty({
    description: "Items de la venta",
    type: [SyncPullSaleItemSchema],
  })
  items: SyncPullSaleItemSchema[];

  @ApiProperty({ description: "Subtotal", example: 90 })
  subtotal: number;

  @ApiProperty({ description: "Monto de impuestos", example: 10 })
  taxAmount: number;

  @ApiProperty({ description: "Descuento aplicado", example: 0 })
  discountAmount: number;

  @ApiProperty({ description: "Total", example: 100 })
  total: number;

  @ApiProperty({ description: "Estado", example: "COMPLETED" })
  status: string;

  @ApiProperty({ description: "Fecha de creación", example: "2024-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ description: "Fecha de sincronización" })
  syncedAt: Date;
}

export class SyncPullResponseSchema {
  @ApiProperty({
    description: "Ventas sincronizadas para el tenant",
    type: [SyncPullSaleSchema],
  })
  sales: SyncPullSaleSchema[];

  @ApiProperty({
    description: "Indica si hay más resultados disponibles",
    example: false,
  })
  hasMore: boolean;

  @ApiProperty({
    description: "Cursor para la siguiente página (null si no hay más)",
    example: null,
    nullable: true,
  })
  nextCursor: string | null;
}
