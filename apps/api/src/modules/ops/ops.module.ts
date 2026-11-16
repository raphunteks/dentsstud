import { Module } from '@nestjs/common';
import { AdminReleasesController, ReleasesController, ReleasesService } from './releases.js';
import { AdminSupportController, SupportController, SupportService } from './support.js';
import { AdminInsightsController, AnalyticsService, OpsController } from './insights.js';

@Module({
  controllers: [ReleasesController, AdminReleasesController, SupportController, AdminSupportController, OpsController, AdminInsightsController],
  providers: [ReleasesService, SupportService, AnalyticsService],
})
export class OpsModule {}
