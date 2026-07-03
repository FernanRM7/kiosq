import { Body, Controller, Get, Post, Req } from "@nestjs/common";

import { OfflineSyncService } from "../services/offline-sync.service";

interface SyncPushBody {
  events?: Record<string, unknown>[];
}

interface SyncRequest {
  query?: Record<string, string | string[] | undefined>;
}

@Controller("api/sync")
export class SyncController {
  constructor(private readonly offlineSync: OfflineSyncService) {}

  @Post("push")
  async push(@Body() body: SyncPushBody) {
    const events = body.events ?? [];
    const result = await this.offlineSync.processEvents(events);
    return { data: result, success: true };
  }

  @Get("pull")
  async pull(@Req() req: SyncRequest) {
    const { since } = req.query ?? {};
    const data = await this.offlineSync.getChangesSince(since);
    return { data, success: true };
  }
}
