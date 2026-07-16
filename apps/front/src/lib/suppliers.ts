import { request } from "@/lib/api";

export interface Supplier {
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

export interface SupplierPayload {
  name: string;
  rfc?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface SupplierList {
  active: Supplier[];
  deleted: Supplier[];
}

export function listSuppliers(): Promise<SupplierList> {
  return request<SupplierList>("/api/suppliers");
}

export function getSupplier(supplierId: string): Promise<Supplier> {
  return request<Supplier>(`/api/suppliers/${supplierId}`);
}

export function createSupplier(payload: SupplierPayload): Promise<Supplier> {
  return request<Supplier>("/api/suppliers", {
    data: payload,
    method: "POST",
  });
}

export function updateSupplier(
  supplierId: string,
  payload: Partial<SupplierPayload>
): Promise<Supplier> {
  return request<Supplier>(`/api/suppliers/${supplierId}`, {
    data: payload,
    method: "PATCH",
  });
}

export function deleteSupplier(supplierId: string): Promise<Supplier> {
  return request<Supplier>(`/api/suppliers/${supplierId}`, {
    method: "DELETE",
  });
}

export function restoreSupplier(supplierId: string): Promise<Supplier> {
  return request<Supplier>(`/api/suppliers/${supplierId}/restore`, {
    method: "POST",
  });
}
