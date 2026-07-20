import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * NestJS-aware Prisma client.
 *
 * Connects on module initialization and gracefully disconnects when the
 * application shuts down, preventing connection leaks in test environments.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
