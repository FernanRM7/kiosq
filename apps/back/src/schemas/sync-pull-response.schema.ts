import { ApiProperty } from "@nestjs/swagger";

export class SyncPullResponseSchema {
  @ApiProperty({
    description: "Ventas sincronizadas para el tenant",
    example: [
      {
        branchId: "branch-1",
        createdAt: "2024-01-01T00:00:00.000Z",
        discountAmount: 0,
        id: "sale-1",
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            quantity: 2,
            subtotal: 100,
            taxRate: 0.16,
            unitPrice: 50,
          },
        ],
        status: "COMPLETED",
        subtotal: 90,
        taxAmount: 10,
        total: 100,
        userId: "user-1",
      },
    ],
    isArray: true,
  })
  sales: unknown[];
}
