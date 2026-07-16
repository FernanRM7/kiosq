import { Injectable } from "@nestjs/common";
import type { Supplier as SupplierRecord } from "@prisma/client";

import { PrismaService } from "../lib/prisma.service";

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
  constructor(private readonly prisma: PrismaService) {}

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
}
