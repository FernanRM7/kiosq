import { Body, Controller, Get, Post, Req } from "@nestjs/common";

import { OfflineSyncService } from "../services/offline-sync.service";

@Controller("api/sync")
export class SyncController {
  constructor(private readonly offlineSync: OfflineSyncService) {}

  @Post("push")
  async push(@Body() body: any) {
    const events = body.events ?? [];
    const result = await this.offlineSync.processEvents(events);
    return { data: result, success: true };
  }

  @Get("pull")
  async pull(@Req() req: any) {
    const { since } = req.query;
    const data = await this.offlineSync.getChangesSince(since);
    return { data, success: true };
  }
}
