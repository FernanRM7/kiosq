import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Supplier as SupplierRecord } from "@prisma/client";

import { PrismaService } from "../lib/prisma.service";
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
} from "../schemas/supplier.schema";
import type { AuthenticatedSessionResult } from "../types/session.type";

export interface SupplierResponse {
  id: string;
  name: string;
  rfc: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierListResponse {
  active: SupplierResponse[];
  deleted: SupplierResponse[];
}

@Injectable()
export class SupplierService {
  private readonly logger = new Logger(SupplierService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listSuppliers(
    session: AuthenticatedSessionResult
  ): Promise<SupplierListResponse> {
    const tenantId = await this.getTenantId(session.userId);

    const [active, deleted] = await Promise.all([
      this.prisma.supplier.findMany({
        orderBy: { name: "asc" },
        where: { isActive: true, tenantId },
      }),
      this.prisma.supplier.findMany({
        orderBy: { name: "asc" },
        where: { isActive: false, tenantId },
      }),
    ]);

    return {
      active: active.map((s) => this.toResponse(s)),
      deleted: deleted.map((s) => this.toResponse(s)),
    };
  }

  async getSupplier(
    session: AuthenticatedSessionResult,
    supplierId: string
  ): Promise<SupplierResponse> {
    const tenantId = await this.getTenantId(session.userId);

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });

    if (!supplier) {
      throw new NotFoundException("Proveedor no encontrado");
    }

    return this.toResponse(supplier);
  }

  async createSupplier(
    session: AuthenticatedSessionResult,
    input: CreateSupplierInput
  ): Promise<SupplierResponse> {
    const tenantId = await this.getTenantId(session.userId);

    try {
      const supplier = await this.prisma.supplier.create({
        data: {
          address: input.address ?? null,
          email: input.email ?? null,
          name: input.name.trim(),
          phone: input.phone ?? null,
          rfc: input.rfc ?? null,
          tenantId,
        },
      });

      return this.toResponse(supplier);
    } catch (error) {
      this.logger.error(
        { err: error, tenantId, userId: session.userId },
        "Failed to create supplier"
      );
      this.handlePrismaError(error);
    }
  }

  async updateSupplier(
    session: AuthenticatedSessionResult,
    supplierId: string,
    input: UpdateSupplierInput
  ): Promise<SupplierResponse> {
    const tenantId = await this.getTenantId(session.userId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const supplier = await tx.supplier.findFirst({
          select: { id: true },
          where: { id: supplierId, isActive: true, tenantId },
        });

        if (!supplier) {
          throw new NotFoundException("Proveedor no encontrado");
        }

        const data: Prisma.SupplierUpdateInput = {};

        if ("name" in input && input.name) {
          data.name = input.name.trim();
        }

        if ("rfc" in input) {
          data.rfc = input.rfc ?? null;
        }

        if ("email" in input) {
          data.email = input.email ?? null;
        }

        if ("phone" in input) {
          data.phone = input.phone ?? null;
        }

        if ("address" in input) {
          data.address = input.address ?? null;
        }

        const updatedSupplier = await tx.supplier.update({
          data,
          where: { id: supplierId },
        });

        return this.toResponse(updatedSupplier);
      });
    } catch (error) {
      this.logger.error(
        { err: error, supplierId, tenantId, userId: session.userId },
        "Failed to update supplier"
      );
      this.handlePrismaError(error);
    }
  }

  async deleteSupplier(
    session: AuthenticatedSessionResult,
    supplierId: string
  ): Promise<SupplierResponse> {
    const tenantId = await this.getTenantId(session.userId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const supplier = await tx.supplier.findFirst({
          select: { id: true },
          where: { id: supplierId, isActive: true, tenantId },
        });

        if (!supplier) {
          throw new NotFoundException("Proveedor no encontrado");
        }

        const deletedSupplier = await tx.supplier.update({
          data: { isActive: false },
          where: { id: supplierId },
        });

        return this.toResponse(deletedSupplier);
      });
    } catch (error) {
      this.logger.error(
        { err: error, supplierId, tenantId, userId: session.userId },
        "Failed to delete supplier"
      );
      throw error;
    }
  }

  async restoreSupplier(
    session: AuthenticatedSessionResult,
    supplierId: string
  ): Promise<SupplierResponse> {
    const tenantId = await this.getTenantId(session.userId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const supplier = await tx.supplier.findFirst({
          select: { id: true },
          where: { id: supplierId, isActive: false, tenantId },
        });

        if (!supplier) {
          throw new NotFoundException("Proveedor no encontrado");
        }

        const restoredSupplier = await tx.supplier.update({
          data: { isActive: true },
          where: { id: supplierId },
        });

        return this.toResponse(restoredSupplier);
      });
    } catch (error) {
      this.logger.error(
        { err: error, supplierId, tenantId, userId: session.userId },
        "Failed to restore supplier"
      );
      throw error;
    }
  }

  private async getTenantId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      select: { isActive: true, tenantId: true },
      where: { workosUserId: userId },
    });

    if (!user?.isActive) {
      throw new ForbiddenException("Debes tener un workspace activo");
    }

    return user.tenantId;
  }

  private toResponse(record: SupplierRecord): SupplierResponse {
    return {
      address: record.address,
      createdAt: record.createdAt.toISOString(),
      email: record.email,
      id: record.id,
      isActive: record.isActive,
      name: record.name,
      phone: record.phone,
      rfc: record.rfc,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(
        "Ya existe un registro duplicado para este proveedor"
      );
    }

    throw error;
  }
}
