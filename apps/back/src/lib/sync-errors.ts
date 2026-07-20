export type SyncErrorCode =
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "INSUFFICIENT_STOCK"
  | "PRODUCT_NOT_FOUND"
  | "MISSING_OFFLINE_ID"
  | "UNKNOWN_EVENT_TYPE"
  | "INTERNAL_ERROR";

/* eslint-disable max-classes-per-file, unicorn/custom-error-definition */
export class SyncError extends Error {
  constructor(
    public readonly code: SyncErrorCode,
    message: string
  ) {
    super(message);
    this.name = "SyncError";
  }
}

export class InsufficientStockError extends SyncError {
  constructor(productId: string) {
    super("INSUFFICIENT_STOCK", `Insufficient stock for product ${productId}`);
  }
}

export class ProductNotFoundError extends SyncError {
  constructor(productId: string, branchId: string) {
    super(
      "PRODUCT_NOT_FOUND",
      `ProductBranch not found for ${productId}/${branchId}`
    );
  }
}

export class MissingOfflineIdError extends SyncError {
  constructor() {
    super("MISSING_OFFLINE_ID", "Missing offlineId in CREATE_SALE payload");
  }
}
