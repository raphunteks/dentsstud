import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController, MeController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';

@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, SessionService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService, SessionService],
})
export class IdentityModule {}
