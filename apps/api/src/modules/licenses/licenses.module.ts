import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { DevicesController, LicensesController } from './licenses.controller.js';
import { LicenseService } from './license.service.js';

@Module({
  imports: [IdentityModule],
  controllers: [LicensesController, DevicesController],
  providers: [LicenseService],
  exports: [LicenseService],
})
export class LicensesModule {}
