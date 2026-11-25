import { Module } from '@nestjs/common';
import { AdminSocialController, SocialController } from './social.controller.js';
import { SocialService } from './social.service.js';

@Module({
  controllers: [SocialController, AdminSocialController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
