import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Product } from "@/db";
import { populateProducts } from "@/db/repositories/products.repo";
import { createLocalSale } from "@/db/repositories/sales.repo";

import { SyncProvider, useSync } from "@/contexts/sync.context";

vi.mock(import("@/lib/api"), () => ({
  request: vi.fn(),
}));

import { request } from "@/lib/api";

const testProducts: Product[] = [
  {
    id: "prod-1",
    name: "Coca Cola 600ml",
    price: 18.5,
    sku: "COCA-600",
    taxRate: 0.16,
    totalStock: 50,
    isActive: true,
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
];

function SyncHarness() {
  const { pendingCount, status, syncNow } = useSync();
  return (
    <div>
      <span data-testid="pending">{pendingCount}</span>
      <span data-testid="status">{status}</span>
      <button data-testid="sync-btn" onClick={() => syncNow()}>
        sync
      </button>
    </div>
  );
}

describe(SyncProvider, () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await populateProducts(testProducts);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("shows pending count from Dexie on mount", async () => {
    await createLocalSale({
      items: [{ productId: "prod-1", quantity: 2 }],
    });

    render(
      <SyncProvider>
        <SyncHarness />
      </SyncProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("pending")).toHaveTextContent("1");
    });
  });

  it("syncs pending events and marks them as APPLIED", async () => {
    await createLocalSale({
      items: [{ productId: "prod-1", quantity: 2 }],
    });

    vi.mocked(request).mockResolvedValue({ applied: [1], failed: [] });

    render(
      <SyncProvider>
        <SyncHarness />
      </SyncProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("pending")).toHaveTextContent("1");
    });

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });

    await userEvent.click(screen.getByTestId("sync-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("pending")).toHaveTextContent("0");
    });

    expect(screen.getByTestId("status")).toHaveTextContent("idle");
    expect(vi.mocked(request)).toHaveBeenCalledWith("/api/sync/push", {
      data: { events: expect.any(Array) },
      method: "POST",
    });
  });

  it("marks INSUFFICIENT_STOCK events as CONFLICT (not pending)", async () => {
    await createLocalSale({
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    vi.mocked(request).mockResolvedValue({
      applied: [],
      failed: [
        {
          code: "INSUFFICIENT_STOCK",
          id: 1,
          message: "Stock insuficiente",
        },
      ],
    });

    render(
      <SyncProvider>
        <SyncHarness />
      </SyncProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("pending")).toHaveTextContent("1");
    });

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });

    await userEvent.click(screen.getByTestId("sync-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("idle");
    });

    expect(screen.getByTestId("pending")).toHaveTextContent("0");
  });

  it("keeps retryable failed events as PENDING", async () => {
    await createLocalSale({
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    vi.mocked(request).mockResolvedValue({
      applied: [],
      failed: [
        {
          code: "INTERNAL_ERROR",
          id: 1,
          message: "Unexpected server error",
        },
      ],
    });

    render(
      <SyncProvider>
        <SyncHarness />
      </SyncProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("pending")).toHaveTextContent("1");
    });

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });

    await userEvent.click(screen.getByTestId("sync-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("idle");
    });

    expect(screen.getByTestId("pending")).toHaveTextContent("1");
  });

  it("marks REJECTED errors and removes from pending count", async () => {
    await createLocalSale({
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    vi.mocked(request).mockResolvedValue({
      applied: [],
      failed: [
        {
          code: "PRODUCT_NOT_FOUND",
          id: 1,
          message: "Producto no existe",
        },
      ],
    });

    render(
      <SyncProvider>
        <SyncHarness />
      </SyncProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("pending")).toHaveTextContent("1");
    });

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });

    await userEvent.click(screen.getByTestId("sync-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("idle");
    });

    expect(screen.getByTestId("pending")).toHaveTextContent("0");
  });

  it("does not sync when offline", async () => {
    await createLocalSale({
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    render(
      <SyncProvider>
        <SyncHarness />
      </SyncProvider>
    );

    await userEvent.click(screen.getByTestId("sync-btn"));

    expect(vi.mocked(request)).not.toHaveBeenCalled();
    expect(screen.getByTestId("pending")).toHaveTextContent("1");
  });

  it("sets status to error when API call fails", async () => {
    await createLocalSale({
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    vi.mocked(request).mockRejectedValue(new Error("Network error"));

    render(
      <SyncProvider>
        <SyncHarness />
      </SyncProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("pending")).toHaveTextContent("1");
    });

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });

    await userEvent.click(screen.getByTestId("sync-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("error");
    });
  });
});
