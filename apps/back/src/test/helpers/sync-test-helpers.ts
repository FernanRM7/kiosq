import type { AuthenticatedSessionResult } from "../../types/session.type";

export function makeMockTransaction(overrides?: {
  productBranchStock?: number;
  existingSale?: { id: string } | null;
  productBranchFound?: boolean;
}) {
  const stock = overrides?.productBranchStock ?? 10;
  const found = overrides?.productBranchFound ?? true;

  return {
    productBranch: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          found ? { branchId: "branch-1", productId: "prod-1", stock } : null
        ),
      update: jest.fn().mockResolvedValue({
        branchId: "branch-1",
        productId: "prod-1",
        stock: Math.max(0, stock - 2),
      }),
    },
    sale: {
      create: jest.fn().mockResolvedValue({ id: "sale-1" }),
      findUnique: jest.fn().mockResolvedValue(overrides?.existingSale ?? null),
    },
    saleItem: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    stockMovement: {
      create: jest.fn().mockResolvedValue({ id: "movement-1" }),
    },
  };
}

export function makeCreateSaleEvent(
  overrides?: Partial<{
    id: number;
    offlineId: string;
    type: string;
    quantity: number;
    omitOfflineId: boolean;
  }>
) {
  const payload: Record<string, unknown> = {
    createdAt: "2024-01-01T00:00:00.000Z",
    discountAmount: 0,
    items: [
      {
        productId: "prod-1",
        quantity: overrides?.quantity ?? 2,
        subtotal: 100,
        taxRate: 0.16,
        unitPrice: 50,
      },
    ],
    offlineId: overrides?.offlineId ?? "offline-1",
    subtotal: 90,
    taxAmount: 10,
    total: 100,
  };

  if (overrides?.omitOfflineId) {
    delete payload["offlineId"];
  }

  return {
    id: overrides?.id ?? 1,
    payload,
    type: overrides?.type ?? "CREATE_SALE",
  };
}

export function makeMockPrisma(
  tx: ReturnType<typeof makeMockTransaction>,
  userOverrides?: Partial<{
    branchId: string | null;
    tenantId: string;
    isActive: boolean;
  }>
) {
  return {
    $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
    sale: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        branchId: userOverrides?.branchId ?? "branch-1",
        id: "user-1",
        isActive: userOverrides?.isActive ?? true,
        tenantId: userOverrides?.tenantId ?? "tenant-1",
      }),
    },
  } as unknown as {
    $transaction: jest.Mock;
    user: { findUnique: jest.Mock };
    sale: { findMany: jest.Mock };
  };
}

export function makeMockSession(): AuthenticatedSessionResult {
  return {
    accessToken: "mock-token",
    authenticated: true,
    organizationId: "org-1",
    role: "admin",
    sessionId: "session-1",
    user: {} as never,
    userId: "workos-user-1",
  };
}
