import type { PrismaService } from "../../lib/prisma.service";
import type { AuthenticatedSessionResult } from "../../types/session.type";
import type { SyncPayloadInput } from "../../schemas/sync.schema";

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
  const base: SyncPayloadInput = {
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

  const payload: SyncPayloadInput = overrides?.omitOfflineId
    ? (() => {
        const { offlineId: _, ...rest } = base;
        return rest as unknown as SyncPayloadInput;
      })()
    : base;

  return {
    id: overrides?.id ?? 1,
    payload,
    type: (overrides?.type ?? "CREATE_SALE") as "CREATE_SALE",
  };
}

export function makeMockPrisma(
  tx: ReturnType<typeof makeMockTransaction>,
  userOverrides?: Partial<{
    branchId: string | null;
    tenantId: string;
    isActive: boolean;
    userNotFound: boolean;
  }>
) {
  return {
    $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
    sale: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    syncEvent: {
      create: jest.fn().mockResolvedValue({ id: "sync-event-1" }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(
        userOverrides?.userNotFound
          ? null
          : {
              branchId: userOverrides?.branchId ?? "branch-1",
              id: "user-1",
              isActive: userOverrides?.isActive ?? true,
              tenantId: userOverrides?.tenantId ?? "tenant-1",
            }
      ),
    },
  } as unknown as PrismaService;
}

export function makeMockSession(): AuthenticatedSessionResult {
  return {
    accessToken: "mock-token",
    authenticated: true,
    organizationId: "org-1",
    role: "admin",
    sessionId: "session-1",
    user: {
      createdAt: "2024-01-01T00:00:00.000Z",
      email: "user@example.com",
      emailVerified: true,
      externalId: null,
      firstName: "Test",
      id: "workos-user-1",
      lastSignInAt: null,
      lastName: "User",
      locale: null,
      metadata: {},
      name: "Test User",
      object: "user",
      profilePictureUrl: null,
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    userId: "workos-user-1",
  };
}
