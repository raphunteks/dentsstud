import { Module } from '@nestjs/common';
import { AdminLmsController, LmsController } from './lms.controller.js';
import { LmsService } from './lms.service.js';

@Module({
  controllers: [LmsController, AdminLmsController],
  providers: [LmsService],
  exports: [LmsService],
})
export class LmsModule {}
