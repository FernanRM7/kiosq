import { Injectable } from "@nestjs/common";

import { PrismaService } from "../lib/prisma.service";

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}
}
