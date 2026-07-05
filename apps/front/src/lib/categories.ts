import { request } from "@/lib/api";

export const CATEGORIES_CHANGED_EVENT = "categories:changed";

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryPayload {
  name: string;
}

export interface CategoryList {
  active: Category[];
  deleted: Category[];
}

export function listCategories(): Promise<CategoryList> {
  return request<CategoryList>("/api/categories");
}

export function createCategory(payload: CategoryPayload): Promise<Category> {
  return request<Category>("/api/categories", {
    data: payload,
    method: "POST",
  });
}

export function updateCategory(
  categoryId: string,
  payload: Partial<CategoryPayload>
): Promise<Category> {
  return request<Category>(`/api/categories/${categoryId}`, {
    data: payload,
    method: "PATCH",
  });
}

export function deleteCategory(categoryId: string): Promise<Category> {
  return request<Category>(`/api/categories/${categoryId}`, {
    method: "DELETE",
  });
}

export function restoreCategory(categoryId: string): Promise<Category> {
  return request<Category>(`/api/categories/${categoryId}/restore`, {
    method: "POST",
  });
}
