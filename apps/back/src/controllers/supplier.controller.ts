import { Controller } from "@nestjs/common";

import { SupplierService } from "../services/supplier.service";

@Controller("suppliers")
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}
}
