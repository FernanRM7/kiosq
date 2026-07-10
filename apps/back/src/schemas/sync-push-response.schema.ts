import { ApiProperty } from "@nestjs/swagger";

class SyncPushFailedItemSchema {
  @ApiProperty({ description: "ID del evento que falló", example: 1 })
  id: number;

  @ApiProperty({
    description: "Código de error",
    example: "INSUFFICIENT_STOCK",
  })
  code: string;

  @ApiProperty({
    description: "Mensaje descriptivo del error",
    example: "Stock insuficiente para el producto prod-1",
  })
  message: string;
}

export class SyncPushResponseSchema {
  @ApiProperty({
    description: "IDs de eventos aplicados correctamente",
    example: [1, 2],
    type: [Number],
  })
  applied: number[];

  @ApiProperty({
    description: "Eventos que fallaron al aplicarse",
    example: [],
    type: [SyncPushFailedItemSchema],
  })
  failed: SyncPushFailedItemSchema[];
}
