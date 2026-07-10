import type { OfflineSyncService } from "../services/offline-sync.service";
import {
  makeCreateSaleEvent,
  makeMockSession,
} from "./helpers/sync-test-helpers";
import { SyncController } from "../controllers/sync.controller";

describe("SyncController", () => {
  it("passes session to service and returns success envelope", async () => {
    const session = makeMockSession();
    const mockResult = { applied: [1], failed: [] };
    const mockService = {
      processEvents: jest.fn().mockResolvedValue(mockResult),
    } as unknown as OfflineSyncService;

    const controller = new SyncController(mockService);
    const body = { events: [makeCreateSaleEvent()] };

    const res = await controller.push(session, body);

    expect(mockService.processEvents).toHaveBeenCalledWith(
      body.events,
      session
    );
    expect(res).toEqual({ data: mockResult, success: true });
  });

  it("passes since query and session to service for pull", async () => {
    const session = makeMockSession();
    const mockData = { sales: [] };
    const mockService = {
      getChangesSince: jest.fn().mockResolvedValue(mockData),
    } as unknown as OfflineSyncService;

    const controller = new SyncController(mockService);
    const query = { since: "2024-06-01T00:00:00.000Z" };

    const res = await controller.pull(session, query);

    expect(mockService.getChangesSince).toHaveBeenCalledWith(
      "2024-06-01T00:00:00.000Z",
      session
    );
    expect(res).toEqual({ data: mockData, success: true });
  });
});
